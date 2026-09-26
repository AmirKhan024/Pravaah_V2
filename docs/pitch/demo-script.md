# Pravaah: Live Demo Script

## Overview
A 12-step walkthrough for hackathon presentation demonstrating end-to-end flow from venue setup and data trust audit to organiser simulation, live incident handling, and visitor plan updates.

---

### Step 1: Venue Configuration & Infrastructure
- **Click Path**: Navigate to `/owner/venue`
- **What to Say**: "We start in the Venue Manager. Here, organisers define total venue capacity, gate lane counts, and transport connection points. Notice every metric carries a trust rating tag."

### Step 2: Document Audit & Data Trust Verification
- **Click Path**: Navigate to `/owner/documents` -> Select 'Fire NOC' -> Upload sample PDF document -> Click 'Check document'
- **What to Say**: "To ensure venue safety claims are authentic, our LLM extracts structured fields from official documents like Fire NOCs. If claimed capacity exceeds documented limits, trust drops automatically."

### Step 3: Registration Data Ingestion & AI Normalization
- **Click Path**: Navigate to `/owner/registrations` -> Upload `registrations-stadium-small.csv` -> Click 'Upload'
- **What to Say**: "Organisers upload raw attendee registration CSVs. Pravaah normalizes messy columns into structured CrowdGroups without needing any intrusive camera tracking or live GPS."

### Step 4: Event Schedule & Multimodal Transport Setup
- **Click Path**: Navigate to `/owner/event` -> Review gates open, show start time, hotel bookings, and transit timetables
- **What to Say**: "Next, we set up the event schedule and public transit arrival pulses. Pravaah combines hotel stays, train schedules, and parking options to build precise arrival curves."

### Step 5: Organiser Console & Bottleneck Overview
- **Click Path**: Navigate to `/console?event=event_stadium_final` -> View Overview screen
- **What to Say**: "Switching to the Organiser Console, the head sees real-time status banners, active crowd services, and critical bottleneck alerts computed by our deterministic engine."

### Step 6: Time-Series Crowd Simulation
- **Click Path**: Click 'Time' tab in Console navigation bar -> Move time slider across 17:00 to 19:30
- **What to Say**: "By scrubbing through time, the organiser sees exact zone density progression before gates even open, exposing severe bottlenecks at Gate A around 18:15."

### Step 7: Service Action Review & Decision Approval
- **Click Path**: Return to 'Overview' -> Click 'Gate Entry' service -> View Service Detail -> Click 'Approve' on recommended intervention
- **What to Say**: "The system proposes actionable levers—like redirecting metro arrivals to Gate B. The LLM never makes decisions; the system computes, but the head retains total control to approve."

### Step 8: Ground Report & Dynamic Live Incident Logging
- **Click Path**: Click 'Ground' tab in Console navigation bar -> Select 'Gate Scan Drift' -> Enter gate throughput variance -> Submit report
- **What to Say**: "During the live event, field staff report actual gate scan rates. The system recalculates crowd flow dynamically, updating trust levels to 'observed' in real time."

### Step 9: Tamper-Evident Publishing & Hash Ledger Audit
- **Click Path**: Return to 'Overview' -> Click 'Publish Plan'
- **What to Say**: "Once approved, the organiser publishes the master plan. Every decision and timestamp is appended to an immutable, tamper-evident SHA-256 hash ledger for full auditability."

### Step 10: Visitor Personalized Plan Search
- **Click Path**: Navigate to `/v` -> Select language 'Marathi' -> Enter origin area and travel mode -> Click 'Get My Plan'
- **What to Say**: "Visitors access their personalized itinerary without logging in. They receive exact instructions tailored to their travel origin, assigned gate, and recommended arrival window."

### Step 11: Multilingual Visitor Guidance Screen
- **Click Path**: View `/v/plan` -> Toggle language selector between English, Hindi, and Marathi
- **What to Say**: "The visitor screen displays plain, clear instructions in their native language—no complex maps or numbers—reducing confusion and keeping entry gates flowing smoothly."

### Step 12: Real-time Re-plan & Visitor Push Notification Banner (pending)
- **Click Path**: View update banner on `/v/plan` showing live gate adjustment alert (pending)
- **What to Say**: "If live crowd shifts force a reroute mid-event, visitors instantly see an alert banner with updated gate assignments, preventing crowd surges before they form."
