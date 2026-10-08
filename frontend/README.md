# Spectral Insights

X-SpectralNIDS — Master Frontend Development Prompt

1. PROJECT IDENTITY

Build a professional, scalable cybersecurity web application called:

X-SpectralNIDS

Full title:

X-SpectralNIDS: Zone-Grouped Explainable AI for Frequency-Domain Network Intrusion Detection

This is a B.Tech Major Project and Research Project.

The application is a Network Intrusion Detection System (NIDS) dashboard that will eventually connect to a Python/FastAPI backend responsible for:

Network traffic processing

Time-domain feature extraction

FFT/frequency-domain feature extraction

XGBoost attack classification

Raw/per-frequency SHAP explanations

Zone-Grouped SHAP explanations

Real-time traffic streaming

Detection and explanation metrics

The frontend must therefore be designed as a production-quality, modular, API-ready cybersecurity dashboard, not as a static UI mockup.

2. CORE PROJECT IDEA

The system analyzes network traffic through two complementary views:

Time-domain path

Traditional network traffic statistics such as:

packet count

bytes

duration

traffic rate

connection statistics

other backend-provided flow features

Frequency-domain path

Use FFT-derived information from packet inter-arrival behavior to identify periodic/rhythmic patterns that may be difficult to identify using traditional traffic statistics.

The machine-learning model will use these features to classify traffic as:

Normal

Attack

The explanation layer must support two approaches:

Raw SHAP

Show feature/frequency-bin level attribution.

Example:

Frequency Bin 114

Frequency Bin 117

Frequency Bin 121

Zone-Grouped SHAP

Group related frequency components into meaningful attack-rhythm zones and display their importance.

Example:

Zone 1 — Strong periodic component

Zone 2 — Medium periodic component

Zone 3 — Low contribution

The frontend must clearly distinguish these two explanation approaches.

3. VERY IMPORTANT ARCHITECTURE REQUIREMENT

Do NOT tightly couple the UI directly to hardcoded data.

The application must be structured so that the current frontend can use mock/demo data, but later the mock layer can be replaced by real APIs with minimal code changes.

Use this architecture:

UI Components
      ↓
Pages
      ↓
Hooks / State Management
      ↓
API Service Layer
      ↓
Mock API / Real FastAPI Backend
      ↓
REST API + WebSocket


Do not put API calls directly inside large UI components.

Create a dedicated service/API layer.

For example:

src/
├── components/
├── pages/
├── layouts/
├── hooks/
├── services/
│   ├── api/
│   │   ├── detectionApi
│   │   ├── trafficApi
│   │   ├── explanationApi
│   │   ├── analyticsApi
│   │   └── systemApi
│   └── websocket/
│       └── monitoringSocket
├── types/
├── data/
│   └── mock/
├── utils/
├── constants/
├── context/
└── styles/


Use TypeScript interfaces/types for API responses.

The frontend should be backend-agnostic.

4. TECHNOLOGY

Use:

React

TypeScript

Vite

Tailwind CSS

shadcn/ui or similarly clean component system

Recharts or another reliable charting library

React Router

Lucide icons

TanStack Query if appropriate for server-state management

Do not introduce unnecessary libraries.

Use reusable components.

Keep the code modular.

5. DESIGN DIRECTION

Create a professional SOC / cybersecurity operations dashboard.

Design characteristics:

Dark-first interface

Professional cybersecurity/SOC appearance

High information density without becoming cluttered

Clear hierarchy

Strong typography

Subtle borders

Cards/panels

Real-time status indicators

Clear attack severity colors

Responsive layout

Desktop-first but responsive

Avoid:

Gaming UI

Excessive glowing effects

Excessive gradients

Huge decorative elements

Fake 3D effects

Excessive animations

Generic SaaS landing-page styling

The application should look like something a real security analyst could use.

6. GLOBAL LAYOUT

Create a persistent application shell.

Left Sidebar

Include:

Overview

Live Monitoring

Detections

Zone-SHAP Explainability

Analytics

Alerts

Reports

Settings

About

Sidebar should support:

active navigation state

icons

collapsed mode

expanded mode

tooltips when collapsed

Top Header

Include:

current page title

system status

backend connection status

WebSocket status

notification icon

user/profile area

theme control

current time

Example:

X-SpectralNIDS

● Backend Connected
● Live Stream Connected

Notifications     User


7. PAGE 1 — OVERVIEW

Route:

/

or

/overview

This is the primary SOC dashboard.

Show:

KPI cards

Total Traffic Analyzed

Total Alerts

Attack Detection Rate

Active Threats

Additional metrics:

Normal Traffic

Suspicious Traffic

Average Detection Latency

Average Explanation Latency

Current Network Throughput

All KPI cards must be designed so their values can later come from APIs.

Traffic Overview

Create a live-looking time-series chart.

Display:

Normal traffic

Suspicious/malicious traffic

packets/sec or traffic volume

time axis

Allow:

1 minute

5 minutes

15 minutes

1 hour

The chart must support real backend streaming later.

Attack Distribution

Create a chart showing attack categories.

Potential categories:

DDoS

DoS

Port Scan

Brute Force

Botnet

Other

Do not hardcode these permanently.

Attack categories must come from backend data when available.

Latest Detections

Create a table:

Columns:

Time

Source

Destination

Attack Type

Prediction

Confidence

Severity

Status

Rows should be clickable.

Clicking a detection should open a detailed detection view.

Zone-SHAP Summary

Create a dedicated panel showing:

Top Important Frequency Zones

Example:

Zone 1    ████████████████████  0.68
Zone 2    ███████████           0.31
Zone 3    █████                 0.14


Show:

Zone name

Frequency range

SHAP importance

relative importance

attack interpretation if provided by backend

Raw SHAP vs Zone-SHAP

Include a compact comparison chart.

The visualization should allow analysts to understand:

Raw SHAP
Individual frequency-bin contributions

VS

Zone-SHAP
Grouped frequency-zone contributions


Do not fabricate scientific conclusions.

The UI should display actual backend values when available.

8. PAGE 2 — LIVE MONITORING

Route:

/monitoring

Purpose:

Provide real-time monitoring of network activity.

This will eventually connect to:

FastAPI WebSocket

The page should have:

Connection Status

Backend: Connected
WebSocket: Connected
Streaming: Active


If disconnected:

Backend: Disconnected
WebSocket: Reconnecting...


Do not crash the application.

Live Traffic Chart

Show:

packet rate

traffic volume

normal traffic

suspicious traffic

Allow time-window selection.

Live Frequency Spectrum

Create a frequency-domain visualization.

Display:

frequency

magnitude/amplitude

dominant frequency

selected frequency range

The chart must be ready to accept FFT data from backend.

Current Traffic Window

Display:

Source

Destination

Protocol

Packet count

Duration

Inter-arrival statistics

Current classification

Confidence

Live Detection Stream

Show new detections appearing in real time.

Each event should contain:

timestamp

source

destination

attack type

confidence

severity

Use subtle animation for new events only.

9. PAGE 3 — DETECTIONS

Route:

/detections

Create a complete detection management page.

Features:

Search

Date filter

Severity filter

Attack type filter

Normal/Attack filter

Confidence range

Source IP filter

Destination IP filter

Pagination

Table columns:

Timestamp

Source

Destination

Protocol

Attack Type

Prediction

Confidence

Severity

Explanation Status

Actions

Click a row to open:

/detections/:id

10. DETECTION DETAILS PAGE

Route:

/detections/:id

This page should provide a complete investigation view.

Sections:

Detection Summary

Prediction: ATTACK
Confidence: 94.2%
Severity: HIGH
Attack Type: Botnet / Periodic Traffic


Traffic Information

Show:

source

destination

protocol

port

duration

packets

bytes

packet rate

inter-arrival statistics

Time-Domain View

Display relevant traffic statistics.

Frequency-Domain View

Display:

FFT spectrum

dominant frequencies

frequency magnitude

selected frequency region

Raw SHAP Explanation

Show:

feature

frequency bin

SHAP value

positive/negative contribution

Use a horizontal bar chart.

Zone-SHAP Explanation

Show:

zone

frequency range

SHAP value

importance rank

interpretation

Clearly label:

Proposed Zone-Grouped Explanation

Analyst Summary

Provide a backend-generated explanation field.

Example:

"The detection was influenced primarily by a strong periodic traffic component."

Do not generate explanations in the frontend.

11. PAGE 4 — ZONE-SHAP EXPLAINABILITY

Route:

/explainability

This is one of the MOST IMPORTANT pages because it represents the research contribution.

Create a dedicated research/analysis interface.

Header

Title:

Zone-SHAP Explainability

Subtitle:

Frequency-domain explanation analysis for network intrusion detection

Explanation Selector

Allow analyst to select a detection.

Then show:

Raw SHAP

Frequency Bin 114    +0.32
Frequency Bin 117    +0.28
Frequency Bin 121    +0.22
...


Zone-SHAP

Zone 1    +0.68
Zone 2    +0.21
Zone 3    +0.08


Side-by-Side Comparison

Create:

┌─────────────────────┬──────────────────────┐
│ Raw SHAP             │ Zone-SHAP            │
├─────────────────────┼──────────────────────┤
│ Bin 114  +0.32       │ Zone 1 +0.68         │
│ Bin 117  +0.28       │ Zone 2 +0.21         │
│ Bin 121  +0.22       │ Zone 3 +0.08         │
└─────────────────────┴──────────────────────┘


Research Metrics

Show:

Faithfulness

Display backend-calculated score.

Stability

Display backend-calculated score.

Compactness

Display:

Raw SHAP:  X important components
Zone-SHAP: Y important zones


Explanation Latency

Display:

Raw SHAP: XX ms
Zone-SHAP: YY ms


Important:

Do NOT display fake improvement percentages.

If data is unavailable, show:

Awaiting backend experiment results

12. PAGE 5 — ANALYTICS

Route:

/analytics

This is for historical analysis.

Show:

Detection Performance

Accuracy

Precision

Recall

F1-score

False Positive Rate

Model Comparison

Compare:

Time-domain only

Time + frequency-domain

Explanation Comparison

Compare:

Raw SHAP

Zone-SHAP

Metrics:

Faithfulness

Stability

Compactness

Latency

This page is important for the research paper because the experiment results should eventually be visualized here.

13. PAGE 6 — ALERTS

Route:

/alerts

Create an alert management interface.

Each alert:

ID

timestamp

severity

attack type

source

destination

confidence

status

Statuses:

New

Investigating

Confirmed

Resolved

False Positive

Allow:

Mark as investigating

Mark as resolved

Mark as false positive

Open detection

Keep these actions API-ready.

14. PAGE 7 — REPORTS

Route:

/reports

This page is for generating project/research reports.

Provide:

Detection summary

Attack distribution

Model performance

SHAP comparison

Zone-SHAP results

Latency

Date range

Allow future backend integration for:

PDF report generation

CSV export

JSON export

For now, build the UI and service interfaces.

15. PAGE 8 — SETTINGS

Route:

/settings

Sections:

General

Theme

Refresh interval

Default dashboard range

Monitoring

WebSocket endpoint

Auto reconnect

Streaming interval

Detection

Confidence threshold

Alert threshold

Explanation

Default explanation method

Raw SHAP

Zone-SHAP

Backend

Display:

API URL
WebSocket URL
Connection status
Model version


Do not expose secrets.

Use environment variables for API URLs.

16. PAGE 9 — ABOUT

Route:

/about

Explain:

Project

X-SpectralNIDS

Purpose

Frequency-domain network intrusion detection with explainable AI.

Detection

Time-domain + FFT features + XGBoost.

Explainability

Raw SHAP vs Zone-Grouped SHAP.

Research Question

Whether frequency-zone grouping can improve explanation quality compared with per-frequency-bin SHAP.

Team

Create clean team member cards.

Do not hardcode sensitive personal information unless explicitly provided through configuration.

17. BACKEND INTEGRATION ARCHITECTURE

The frontend must be designed for a future FastAPI backend.

Expected future API structure:

/api
├── /health
├── /traffic
├── /detections
├── /detections/{id}
├── /predictions
├── /explanations/raw
├── /explanations/zones
├── /analytics
├── /metrics
└── /reports


WebSocket:

/ws/monitoring


Do not assume the backend implementation already exists.

Create typed service functions/interfaces that can initially use mock data.

18. API DATA CONTRACTS

Create TypeScript interfaces for objects such as:

Detection

interface Detection {
  id: string;
  timestamp: string;
  source: string;
  destination: string;
  protocol?: string;
  attackType: string;
  prediction: "normal" | "attack";
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
}


Frequency Feature

interface FrequencyFeature {
  bin: number;
  frequency: number;
  magnitude: number;
  shapValue?: number;
}


SHAP Zone

interface ShapZone {
  id: string;
  name: string;
  frequencyStart: number;
  frequencyEnd: number;
  shapValue: number;
  rank: number;
  interpretation?: string;
}


Research Metrics

interface ExplanationMetrics {
  faithfulness?: number;
  stability?: number;
  compactness?: number;
  latencyMs?: number;
}


Keep these definitions centralized.

19. MOCK DATA REQUIREMENT

Initially the backend may not exist.

Therefore create a realistic mock service.

Example:

src/data/mock/


Include:

mock detections

mock traffic

mock FFT spectrum

mock Raw SHAP

mock Zone-SHAP

mock analytics

mock system metrics

IMPORTANT:

The UI must obtain mock data through the same service interfaces that will later call FastAPI.

Do NOT directly hardcode mock arrays inside individual components.

This will make backend replacement much easier.

20. WEBSOCKET DESIGN

Create a reusable WebSocket service.

It should support:

connect

disconnect

reconnect

connection status

message handling

error handling

Expected future message structure:

{
  "type": "traffic_update",
  "timestamp": "2026-08-12T12:00:00Z",
  "traffic": {},
  "prediction": {},
  "frequency": {},
  "explanation": {}
}


The frontend should be able to consume this without redesigning the monitoring page.

21. ERROR AND LOADING STATES

Every API-driven page must have:

Loading

Skeleton UI.

Error

Clear error message.

Empty

Example:

No detections found for the selected filters.

Backend disconnected

Show a persistent but non-blocking warning.

WebSocket disconnected

Show:

Reconnecting to live monitoring...

The application must never become unusable because the backend is unavailable.

22. RESEARCH-SAFE UI DESIGN

The UI must NOT make unsupported scientific claims.

Do NOT write:

"Zone-SHAP is better."

Instead write:

"Zone-SHAP Evaluation"

or:

"Comparison with Raw SHAP"

Only show improvement when backend experiment results actually demonstrate it.

The research outcome can be:

Positive

Negative

Mixed

The dashboard must support all three outcomes.

23. FUTURE EXTENSIBILITY

Design the application so future project stages can add:

More ML models

More datasets

More attack categories

Multiple frequency-zone strategies

Adaptive frequency zones

Human analyst feedback

Model version comparison

Cross-dataset evaluation

Real packet capture

PCAP upload

User authentication

Role-based access

PDF/CSV reports

Research experiment management

Do NOT implement all of these now.

Create clean extension points so they can be added later.

24. COMPONENT REUSABILITY

Create reusable components such as:

StatCard
StatusBadge
SeverityBadge
TrafficChart
FrequencySpectrum
DetectionTable
DetectionDetails
ShapBarChart
ZoneShapChart
ShapComparison
MetricCard
ConnectionStatus
EmptyState
LoadingState
ErrorState
FilterBar
DateRangePicker


Do not duplicate these components across pages.

25. COLOR SYSTEM

Use a professional cybersecurity color system.

Normal:

green

Warning:

amber/yellow

Attack:

red

Informational:

blue

Research/Explainability:

purple

Do not use colors as the only indication of severity; always include text/icons.

26. PERFORMANCE REQUIREMENTS

The frontend should remain responsive with:

thousands of detection records

frequently updating traffic charts

WebSocket updates

large SHAP datasets

Use:

pagination

memoization where useful

controlled chart update frequency

virtualization if necessary

efficient state updates

Do not rerender the entire application whenever a single live traffic point arrives.

27. SECURITY REQUIREMENTS

This is a cybersecurity project, so follow good frontend security practices.

Do not:

expose API secrets

expose backend credentials

store sensitive credentials in source code

use unsafe HTML rendering

trust arbitrary backend HTML

put secrets in localStorage

Use environment variables for configurable endpoints.

Example:

VITE_API_BASE_URL
VITE_WS_BASE_URL


28. DEVELOPMENT PHASES

Build the frontend in phases.

Phase 1 — Foundation

Create:

project structure

routing

sidebar

header

theme

reusable components

mock service

TypeScript models

Phase 2 — Core Dashboard

Build:

Overview

Live Monitoring

Detections

Detection Details

Phase 3 — Research UI

Build:

Zone-SHAP Explainability

Raw vs Zone comparison

Research metrics

Analytics

Phase 4 — Operational Pages

Build:

Alerts

Reports

Settings

About

Phase 5 — Backend Integration

Replace mock services with:

REST APIs

WebSocket

Do not redesign UI during backend integration unless required by actual API contracts.

29. IMPORTANT IMPLEMENTATION RULE

Do NOT generate the entire project as one giant monolithic component.

Use:

Page
 ↓
Section
 ↓
Reusable component
 ↓
Service/hook
 ↓
API


Maintain separation of concerns.

30. BACKEND-READY RULE

Every piece of data displayed on the UI should have a clear future source.

For example:

Total Alerts
      ↓
GET /api/analytics/summary


Latest Detections
      ↓
GET /api/detections


Live Traffic
      ↓
WebSocket /ws/monitoring


Raw SHAP
      ↓
GET /api/explanations/raw/{detectionId}


Zone-SHAP
      ↓
GET /api/explanations/zones/{detectionId}


Do not create UI elements whose backend integration would require rewriting the architecture.

31. FINAL UI GOAL

The final application should feel like:

A real Security Operations Center dashboard combined with an Explainable AI research platform.

It should allow a user to:

Monitor traffic
      ↓
Detect attacks
      ↓
Open detection
      ↓
See time-domain information
      ↓
See FFT/frequency information
      ↓
See Raw SHAP
      ↓
See Zone-SHAP
      ↓
Compare explanations
      ↓
Inspect research metrics


The main research-focused screen should make the central comparison visually obvious:

             CURRENT DETECTION
                    │
          ┌─────────┴─────────┐
          ↓                   ↓
       RAW SHAP           ZONE-SHAP
      Per frequency       Grouped zones
          ↓                   ↓
     Many individual       Few meaningful
       contributions          zones
          └─────────┬─────────┘
                    ↓
             COMPARISON
                    ↓
      Faithfulness | Stability
      Compactness  | Latency


32. DO NOT OVERBUILD

This is a major project that will increase in complexity over time.

Therefore:

Build the architecture for future complexity, but implement only the current required functionality.

Do not add:

unnecessary authentication

unnecessary databases

unnecessary cloud infrastructure

unnecessary AI models

unnecessary animations

fake live data presented as real

unsupported research claims

The current objective is a clean, scalable frontend foundation that can grow as the Python/FastAPI/XGBoost/FFT/SHAP backend develops.

33. FIRST IMPLEMENTATION TASK

Start by creating:

React + TypeScript + Vite project

Tailwind/shadcn setup

Application layout

Sidebar navigation

Top header

Routing

TypeScript data models

Mock API service layer

Overview page

Live Monitoring page

Detections page

Detection Details page

After those are stable, implement:

Zone-SHAP Explainability

Analytics

Alerts

Reports

Settings

About

Then prepare the application for FastAPI/WebSocket integration.

Before completing each phase, keep the existing architecture intact and avoid replacing working components unnecessarily.

The final frontend must be modular, maintainable, research-oriented, visually professional, responsive, and ready for incremental backend integration.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb5b356d-8dd5-409d-a3fa-c3afb2fe42c9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
