"""Inspect and preprocess the eight original CICIDS2017 flow CSVs.

Run from any directory, for example:
    python backend/preprocess_cicids2017.py --smote-ratio 0.05

The SMOTE ratio is the desired minority/majority ratio in the training split
only. It is required because full balancing of this 2.8M-row dataset can
produce an impractically large training file. No dataset labels are corrected.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "processed" / "cicids2017_original"
LABEL_COLUMN = "Label"
CHUNK_SIZE = 100_000
SPLIT_CODES = {"train": 0, "validation": 1, "test": 2}
SPLIT_FRACTIONS = (0.64, 0.16, 0.20)
IDENTIFIER_NAMES = {
    "flow id", "source ip", "src ip", "destination ip", "dest ip", "dst ip", "timestamp"
}
POSSIBLE_DUPLICATE_COLUMNS = {"Fwd Header Length.1": "Fwd Header Length"}


def normalized_columns(path: Path) -> pd.Index:
    columns = pd.read_csv(path, nrows=0, skipinitialspace=True).columns.str.strip()
    if columns.duplicated().any():
        raise ValueError(f"Duplicate column names in {path.name}: {columns[columns.duplicated()].tolist()}")
    if LABEL_COLUMN not in columns:
        raise ValueError(f"Required target column {LABEL_COLUMN!r} missing in {path.name}")
    return columns


def feature_columns(columns: pd.Index, removed: list[str]) -> list[str]:
    return [name for name in columns if name != LABEL_COLUMN and name not in removed]


def labels_for(frame: pd.DataFrame) -> pd.Series:
    labels = frame[LABEL_COLUMN].astype("string").str.strip()
    return labels.mask(labels.eq(""), pd.NA)


def formatted_counts(counts: Counter[str] | dict[str, int]) -> dict[str, int]:
    return {str(label): int(count) for label, count in sorted(counts.items())}


def allocate_splits(class_counts: Counter[str], seed: int) -> dict[str, np.ndarray]:
    """Assign each class independently to approximate 64/16/20 splits."""
    rng = np.random.default_rng(seed)
    assignments: dict[str, np.ndarray] = {}
    too_small = [label for label, count in class_counts.items() if count < 3]
    if too_small:
        raise ValueError(f"Three-way stratification needs >=3 rows per class: {too_small}")

    for label, count in class_counts.items():
        train_count = int(round(count * SPLIT_FRACTIONS[0]))
        validation_count = int(round(count * SPLIT_FRACTIONS[1]))
        test_count = count - train_count - validation_count
        if min(train_count, validation_count, test_count) < 1:
            raise ValueError(f"Class {label!r} cannot appear in all splits ({count} rows)")
        codes = np.concatenate(
            [
                np.full(train_count, SPLIT_CODES["train"], dtype=np.uint8),
                np.full(validation_count, SPLIT_CODES["validation"], dtype=np.uint8),
                np.full(test_count, SPLIT_CODES["test"], dtype=np.uint8),
            ]
        )
        assignments[label] = rng.permutation(codes)
    return assignments


def print_file_audit(
    path: Path,
    rows: int,
    class_counts: Counter[str],
    missing: Counter[str],
    infinite: Counter[str],
    dtypes: dict[str, str],
) -> None:
    print(f"\n=== {path.name} ({rows:,} rows) ===")
    print("Class distribution:")
    for label, count in sorted(class_counts.items()):
        print(f"  {label!r}: {count:,}")
    print("Missing values:", {k: v for k, v in sorted(missing.items()) if v} or "none")
    print("Infinite values:", {k: v for k, v in sorted(infinite.items()) if v} or "none")
    print("Dtypes:")
    for name, dtype in dtypes.items():
        print(f"  {name}: {dtype}")


def audit_inputs(paths: list[Path]) -> tuple[dict[str, Any], pd.Index, list[str]]:
    reference: pd.Index | None = None
    all_labels: Counter[str] = Counter()
    valid_labels: Counter[str] = Counter()
    invalid_by_label: Counter[str] = Counter()
    missing_totals: Counter[str] = Counter()
    infinite_totals: Counter[str] = Counter()
    per_file: dict[str, Any] = {}
    duplicate_verified = {name: True for name in POSSIBLE_DUPLICATE_COLUMNS}

    for path in paths:
        columns = normalized_columns(path)
        if reference is None:
            reference = columns
        elif not columns.equals(reference):
            raise ValueError(f"CSV schema differs from other files: {path.name}")

        identifiers = [name for name in columns if name.casefold() in IDENTIFIER_NAMES]
        features = feature_columns(columns, identifiers)
        candidates = [name for name in POSSIBLE_DUPLICATE_COLUMNS if name in columns]
        file_labels: Counter[str] = Counter()
        file_missing: Counter[str] = Counter()
        file_infinite: Counter[str] = Counter()
        file_invalid: Counter[str] = Counter()
        dtypes: dict[str, str] = {}
        rows = 0

        for chunk in pd.read_csv(path, chunksize=CHUNK_SIZE, low_memory=False, skipinitialspace=True):
            chunk.columns = chunk.columns.str.strip()
            rows += len(chunk)
            labels = labels_for(chunk)
            file_labels.update(labels.fillna("<MISSING LABEL>").value_counts().to_dict())
            if not dtypes:
                dtypes = {name: str(dtype) for name, dtype in chunk.dtypes.items()}

            non_numeric = [name for name in features if not pd.api.types.is_numeric_dtype(chunk[name].dtype)]
            if non_numeric:
                raise TypeError(f"Non-numeric feature columns in {path.name}: {non_numeric}")

            values_frame = chunk[features]
            file_missing.update(values_frame.isna().sum().to_dict())
            values = values_frame.to_numpy(dtype=np.float64, copy=False)
            missing_row = values_frame.isna().any(axis=1).to_numpy()
            finite_row = np.isfinite(values).all(axis=1)
            label_array = labels.to_numpy(dtype=object)
            missing_label = pd.isna(label_array)
            invalid = missing_row | ~finite_row | missing_label
            infinite_cells = (~np.isfinite(values) & ~np.isnan(values)).sum(axis=0)
            file_infinite.update(
                {name: int(count) for name, count in zip(features, infinite_cells) if count}
            )
            file_invalid.update(labels[invalid & ~missing_label].value_counts().to_dict())
            valid_labels.update(labels[~invalid].value_counts().to_dict())

            for duplicate, original in POSSIBLE_DUPLICATE_COLUMNS.items():
                if duplicate in chunk and (original not in chunk or not chunk[duplicate].equals(chunk[original])):
                    duplicate_verified[duplicate] = False

        all_labels.update(file_labels)
        missing_totals.update(file_missing)
        infinite_totals.update(file_infinite)
        invalid_by_label.update(file_invalid)
        print_file_audit(path, rows, file_labels, file_missing, file_infinite, dtypes)
        per_file[path.name] = {
            "rows": rows,
            "class_distribution": formatted_counts(file_labels),
            "missing_values": {k: int(v) for k, v in file_missing.items() if v},
            "infinite_values": {k: int(v) for k, v in file_infinite.items() if v},
            "invalid_rows_dropped_by_label": formatted_counts(file_invalid),
            "dtypes": dtypes,
        }

    if reference is None:
        raise ValueError(f"No CSV files found in {RAW_DIR}")
    duplicates = [
        name for name, equal in duplicate_verified.items() if equal and name in reference
    ]
    removed = [name for name in reference if name.casefold() in IDENTIFIER_NAMES] + duplicates
    suspicious_labels = [label for label in all_labels if "\ufffd" in label]
    rare_classes = {label: count for label, count in valid_labels.items() if count < 100}

    print("\n=== Combined input summary ===")
    print(f"Rows: {sum(item['rows'] for item in per_file.values()):,}")
    print("Class distribution:")
    for label, count in sorted(all_labels.items()):
        print(f"  {label!r}: {count:,}")
    print(f"Rows removed for invalid features/missing label: {sum(invalid_by_label.values()):,}")
    print(f"Removed columns: {removed or 'none'}")
    print(f"Labels containing U+FFFD (retained): {suspicious_labels or 'none'}")
    print(f"Classes with fewer than 100 valid rows (review): {rare_classes or 'none'}")

    audit = {
        "files": per_file,
        "all_class_distribution": formatted_counts(all_labels),
        "valid_class_distribution": formatted_counts(valid_labels),
        "removed_columns": removed,
        "feature_columns": feature_columns(reference, removed),
        "missing_values_total": {k: int(v) for k, v in missing_totals.items() if v},
        "infinite_values_total": {k: int(v) for k, v in infinite_totals.items() if v},
        "invalid_rows_dropped_by_label": formatted_counts(invalid_by_label),
        "labels_containing_replacement_character": suspicious_labels,
        "rare_classes_under_100_valid_rows": rare_classes,
        "valid_class_counts_internal": valid_labels,
        "total_rows": sum(item["rows"] for item in per_file.values()),
    }
    return audit, reference, removed


def write_clean_splits(
    paths: list[Path],
    columns: pd.Index,
    removed: list[str],
    class_counts: Counter[str],
    output_dir: Path,
    seed: int,
) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    assignments = allocate_splits(class_counts, seed)
    features = feature_columns(columns, removed)
    output_columns = [name for name in columns if name not in removed]
    output_paths = {
        name: output_dir / f"cicids2017_original_{name}.csv"
        for name in SPLIT_CODES
    }
    for path in output_paths.values():
        path.unlink(missing_ok=True)

    consumed: Counter[str] = Counter()
    for path in paths:
        for chunk in pd.read_csv(path, chunksize=CHUNK_SIZE, low_memory=False, skipinitialspace=True):
            chunk.columns = chunk.columns.str.strip()
            labels = labels_for(chunk)
            values_frame = chunk[features]
            values = values_frame.to_numpy(dtype=np.float64, copy=False)
            invalid = values_frame.isna().any(axis=1).to_numpy()
            invalid |= ~np.isfinite(values).all(axis=1)
            label_array = labels.to_numpy(dtype=object)
            invalid |= pd.isna(label_array)
            valid_positions = np.flatnonzero(~invalid)
            codes = np.empty(len(chunk), dtype=np.uint8)

            valid_label_values = labels.iloc[valid_positions].to_numpy(dtype=object)
            for label in pd.unique(valid_label_values):
                positions = valid_positions[valid_label_values == label]
                start = consumed[str(label)]
                end = start + len(positions)
                codes[positions] = assignments[str(label)][start:end]
                consumed[str(label)] = end

            clean = chunk.loc[~invalid, output_columns].copy()
            clean[LABEL_COLUMN] = labels.loc[~invalid].to_numpy()
            for split_name, code in SPLIT_CODES.items():
                selected = codes[valid_positions] == code
                if selected.any():
                    clean.loc[selected].to_csv(
                        output_paths[split_name],
                        mode="a",
                        index=False,
                        header=not output_paths[split_name].exists(),
                    )

    if consumed != class_counts:
        differences = {
            label: {"expected": int(count), "assigned": int(consumed[label])}
            for label, count in class_counts.items()
            if consumed[label] != count
        }
        raise RuntimeError(f"Split assignment mismatch: {differences}")
    return output_paths


def apply_smote(
    train_path: Path,
    features: list[str],
    ratio: float,
    requested_neighbors: int,
    seed: int,
) -> tuple[dict[str, int], dict[str, int], int]:
    from imblearn.over_sampling import SMOTE

    training = pd.read_csv(
        train_path,
        dtype={name: np.float32 for name in features},
        low_memory=False,
    )
    before_counts = Counter(training[LABEL_COLUMN].astype(str))
    target_count = int(math.ceil(max(before_counts.values()) * ratio))
    strategy = {label: target_count for label, count in before_counts.items() if count < target_count}
    if not strategy:
        return formatted_counts(before_counts), formatted_counts(before_counts), 0

    smallest_target_class = min(before_counts[label] for label in strategy)
    if smallest_target_class < 2:
        raise ValueError("SMOTE requires at least two training rows in each oversampled class")
    neighbors = min(requested_neighbors, smallest_target_class - 1)
    print(
        f"\nTraining-only SMOTE: target ratio={ratio:g}; "
        f"target rows/class={target_count:,}; k_neighbors={neighbors}"
    )
    x = training[features].to_numpy(dtype=np.float32, copy=False)
    y = training[LABEL_COLUMN].astype(str).to_numpy()
    del training
    sampler = SMOTE(sampling_strategy=strategy, random_state=seed, k_neighbors=neighbors)
    x_resampled, y_resampled = sampler.fit_resample(x, y)
    del x, y, sampler

    after_counts = Counter(y_resampled.astype(str))
    result = pd.DataFrame(x_resampled, columns=features)
    result[LABEL_COLUMN] = y_resampled
    temporary_path = train_path.with_suffix(".smote.tmp.csv")
    result.to_csv(temporary_path, index=False)
    temporary_path.replace(train_path)
    del result, x_resampled, y_resampled
    return formatted_counts(before_counts), formatted_counts(after_counts), neighbors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--smote-ratio",
        type=float,
        required=True,
        help="Explicit target minority/majority ratio for training SMOTE (0, 1].",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--smote-neighbors", type=int, default=5)
    parser.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()
    if not 0 < args.smote_ratio <= 1:
        parser.error("--smote-ratio must be greater than 0 and at most 1")
    if args.smote_neighbors < 1:
        parser.error("--smote-neighbors must be at least 1")
    return args


def main() -> int:
    args = parse_args()
    paths = sorted(args.raw_dir.glob("*.csv"))
    if not paths:
        print(f"No CSV files found in {args.raw_dir}", file=sys.stderr)
        return 2

    audit, columns, removed = audit_inputs(paths)
    class_counts: Counter[str] = audit.pop("valid_class_counts_internal")
    if min(class_counts.values()) < 3:
        raise ValueError("At least one class has too few valid rows for a stratified split")
    try:
        from imblearn.over_sampling import SMOTE as _SMOTE  # noqa: F401
    except ImportError:
        print(
            "\nMissing SMOTE dependencies. Install with: "
            "python -m pip install scikit-learn imbalanced-learn",
            file=sys.stderr,
        )
        return 2

    args.output_dir.mkdir(parents=True, exist_ok=True)
    split_paths = write_clean_splits(
        paths, columns, removed, class_counts, args.output_dir, args.seed
    )
    before, after, effective_neighbors = apply_smote(
        split_paths["train"],
        audit["feature_columns"],
        args.smote_ratio,
        args.smote_neighbors,
        args.seed,
    )
    provenance = {
        "dataset": "Original CICIDS2017 download; no corrected-version rules applied",
        "inputs": [str(path.resolve()) for path in paths],
        "output_files": {name: str(path.resolve()) for name, path in split_paths.items()},
        "seed": args.seed,
        "split_fractions": {"train": 0.64, "validation": 0.16, "test": 0.20},
        "smote": {
            "applied_to": "training split only",
            "target_minority_to_majority_ratio": args.smote_ratio,
            "requested_k_neighbors": args.smote_neighbors,
            "effective_k_neighbors": effective_neighbors,
            "class_distribution_before": before,
            "class_distribution_after": after,
            "numeric_features_downcast_to_float32_for_smote": True,
        },
        "changes": [
            "Trimmed leading/trailing whitespace from column names and labels.",
            "Dropped rows with missing/infinite numeric features or missing labels; did not fill with zero.",
            "Removed only identifier columns and verified exact duplicate columns listed below.",
            "Retained original class labels; no category harmonization or label correction was applied.",
            "Converted numeric training features to float32 for SMOTE memory use.",
        ],
        "removed_columns": removed,
        "feature_columns": audit["feature_columns"],
        "cleaning": {
            "total_input_rows": audit["total_rows"],
            "all_class_distribution_before_cleaning": audit["all_class_distribution"],
            "valid_class_distribution_before_split": audit["valid_class_distribution"],
            "missing_values_by_column": audit["missing_values_total"],
            "infinite_values_by_column": audit["infinite_values_total"],
            "invalid_rows_dropped_by_label": audit["invalid_rows_dropped_by_label"],
        },
        "review_flags": {
            "labels_containing_unicode_replacement_character_retained": audit[
                "labels_containing_replacement_character"
            ],
            "classes_under_100_valid_rows": audit["rare_classes_under_100_valid_rows"],
            "note": "Observed anomalies and rare classes are not confirmed relabeling instructions.",
        },
        "per_file_audit": audit["files"],
        "frequency_feature_note": (
            "These inputs contain aggregated flow statistics, including Flow IAT summaries, "
            "not raw packet-level inter-arrival sequences for FFT."
        ),
    }
    provenance_path = args.output_dir / "cicids2017_original_provenance.json"
    provenance_path.write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + "\n")
    print("\nSaved cleaned split files:")
    for name, path in split_paths.items():
        print(f"  {name}: {path}")
    print(f"  provenance: {provenance_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())