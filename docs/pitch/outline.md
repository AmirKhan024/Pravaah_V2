# Pravaah: 5-Minute Hackathon Pitch Outline

## The Problem (2 Lines)
Massive event crowds crash venue infrastructure because organisers react to bottlenecks after they happen.
Existing solutions rely on invasive tracking or expensive hardware instead of predictive arrival planning.

## The Three Parts
- **The Organiser (The Head)**: Manages hotels, travel, gates, routes, and food; retains final authority to approve or skip actions.
- **The System**: Runs deterministic scenario simulations, detects bottlenecks, computes densities, and proposes interventions.
- **The Visitor**: Sees only the head-approved, personalized arrival plan in their language with clear gate, time, and transit instructions.

## Forecast from Registration Data (No Cameras, No Live Location)
- Raw registration CSVs capture visitor origin, travel mode, hotel booking, group size, and gate hints.
- Normalization maps registrations into standardized CrowdGroups matching engine Cohort models.
- Arrival curves and transport timetables project crowd volume at venue entry points over time.
- Predicts peak congestion hours before gates open without CCTV cameras, facial recognition, or continuous GPS tracking.

## Trust Levels for Venue Data
- **Claimed**: Self-reported venue capacities or scan rates without proof; automatically discounted by 25% in simulation.
- **Documented**: Verified numbers backed by uploaded Fire NOCs or Occupancy Certificates extracted via LLM OCR.
- **Observed**: Real-time ground data from live gate scans or verified field staff counts receiving 100% simulation credit.
- Discount factors applied strictly in centralized trust configuration before running the engine.

## Venue Agnostic: 2 Sample Events
- **Continental Cup Final (Stadium)**: Fixed perimeter venue with 55,000 capacity, 3 gates, hotel coach routing, and scheduled transport pulses.
- **Ganesh Visarjan (Procession)**: Dynamic linear route with 150,000 participants, open city gathering points, and walking crowd cohorts.
- Demonstrates graph-based network engine flexibility for both enclosed stadiums and open city streets.

## What is Real vs. Assumed
- **Real**: Deterministic math simulation engine, zod-validated LLM document parsing, normalized registration mapping, and immutable SHA-256 hash ledger.
- **Assumed**: Projected visitor arrival curves, unverified claimed lane throughput rates prior to live scanning, and initial hotel coach capacities.
- Every unverified or calculated metric is explicitly labeled as "assumption" across the UI.

## 5 Questions Judges May Ask (With 1-Line Answers)
1. **How do you handle privacy without live GPS tracking?**
   We predict crowd density using pre-event registration data and transport timetables rather than tracking individual locations.
2. **What happens if crowd arrival deviates from the forecast?**
   Live gate scans feed back into the system to compute drift and automatically trigger updated rerouting recommendations.
3. **Can venue managers falsify capacity numbers to look safer?**
   Unverified claimed numbers are automatically penalized in the simulation, requiring verified documents or live scans for full credit.
4. **Why let the LLM parse documents if it cannot be trusted with math?**
   The LLM only extracts structured text from messy PDFs, while our deterministic TypeScript engine computes all densities and numbers.
5. **How do visitors know their plan changed mid-event?**
   When the organiser publishes an update, the visitor web app highlights new gate and arrival instructions with an instant alert banner.
