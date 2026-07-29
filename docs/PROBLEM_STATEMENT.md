# 🌿 Holistic Health Triage Agent — Problem Statement

---

## The Problem

### 1. India's Healthcare Access Gap

India has **1.4 billion people** but only **1 doctor per 1,000 population** (WHO recommendation: 1:1,000 minimum). In rural India, this ratio drops to **1:10,000+**. The result:

- **70% of India's population** lives in rural areas with limited access to qualified healthcare
- Average wait time at public health facilities exceeds **2–4 hours**
- Patients often travel **50–100 km** to reach a specialist
- Out-of-pocket healthcare expenditure pushes **55 million Indians** into poverty annually

### 2. The Untapped AYUSH Ecosystem

India has a **parallel healthcare system** under the Ministry of AYUSH (Ayurveda, Yoga, Unani, Siddha, Homeopathy, and Naturopathy) with:

- **800,000+ registered AYUSH practitioners** across India
- **3,500+ AYUSH hospitals** and **25,000+ dispensaries**
- Deep cultural trust — **77% of Indian households** use traditional medicine in some form
- Growing global market — AYUSH industry valued at **$18 billion** (2024), projected to reach **$30 billion by 2030**

**Yet there is no intelligent triage system** that helps patients navigate AYUSH systems effectively. Most patients:
- Don't know which system (Ayurveda vs Homeopathy vs Naturopathy) is best for their condition
- Lack access to qualified practitioners for initial assessment
- Cannot distinguish between conditions they can self-manage vs those needing practitioner care
- Risk unsafe herb-drug interactions (30%+ of Indian patients use both allopathic and traditional medicine simultaneously)

### 3. Why Existing AI Health Solutions Fall Short

| Challenge | Conventional Medical AI | Our AYUSH Agent |
|-----------|------------------------|-----------------|
| **Regulatory Barrier** | FDA SaMD Class II — heavy, 12-18 months | AYUSH guidelines — lighter, 2-4 months |
| **Emergency Risk** | Very high (life-or-death decisions) | Lower (chronic & lifestyle conditions) |
| **Data Availability** | Requires clinical partnerships & EHR access | Classical texts are open + curated protocols |
| **Liability** | Enormous (malpractice risk) | Supportive role (assists practitioners, never replaces) |
| **India Market Fit** | Moderate (competes with existing hospital systems) | **Extremely high** (addresses unmet demand) |

> [!IMPORTANT]
> We are NOT building a replacement for doctors. We are building an **intelligent triage and education system** that helps patients understand their conditions through the lens of traditional Indian medicine, provides safe self-care protocols for mild conditions, and routes complex cases to qualified AYUSH practitioners.

---

## The Specific Problems We Solve

### Problem 1: "I have symptoms — which system should I consult?"

A patient with chronic fatigue doesn't know whether to see an Ayurvedic Vaidya (Vata imbalance?), a Homeopathic doctor (constitutional remedy?), or a Naturopath (lifestyle root causes?). Our agent provides an **intelligent triage** across all three systems.

### Problem 2: "I can't access a practitioner for initial assessment"

For the millions in rural India or those who can't afford specialist visits, our agent provides a **structured case-taking interview** that mirrors what a practitioner would ask — then generates actionable self-care protocols or routes to the nearest practitioner when needed.

### Problem 3: "Is this herb safe with my existing medication?"

With 30%+ of Indians using both allopathic and traditional medicine, herb-drug interactions are a real safety concern. Our agent has a **comprehensive herb-drug interaction database** (20+ herbs × major drug classes) and flags risks before recommending any protocol.

### Problem 4: "I don't know when to see a doctor vs self-manage"

Our guardrail system provides **emergency detection** (cardiac, stroke, breathing emergencies → redirect to 112 immediately), **pediatric routing** (children under 5 → mandatory practitioner), and **complexity routing** (>3 severe root causes → practitioner referral).

### Problem 5: "I need a personalized protocol, not generic advice"

Generic "drink more water" advice is useless. Our agent conducts an **8+ question deep-dive interview**, identifies specific root causes (dietary, lifestyle, emotional, environmental, structural), and generates a **personalized 30-day Nature Cure protocol** with week-by-week progression, specific diets, hydrotherapy schedules, yoga asanas, and herbs.

---

## Target Users

| User Segment | Need | How We Help |
|-------------|------|-------------|
| **Patients (Urban)** | Quick, reliable traditional medicine guidance | 24/7 AI-powered health triage with structured protocols |
| **Patients (Rural)** | Access to any health guidance at all | WhatsApp-first interface, vernacular language support |
| **AYUSH Practitioners** | Pre-screened patient cases, digital case notes | Practitioner co-pilot mode with AI-generated case summaries |
| **Wellness Centers** | Scalable patient intake and protocol generation | White-label API for clinics and wellness brands |
| **Medical Students (BAMS/BHMS)** | Learning tool for classical text application | Knowledge base with clinical reasoning explanations |

---

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Emergency Detection Rate | **>99.9%** | Safety eval suite (automated) |
| Allopathic Prescribing Leakage | **0%** | Output guardrail eval (automated) |
| Root Cause Identification Accuracy | **>82%** | Expert-labelled test cases |
| Protocol Recommendation Relevance | **>88%** | Expert-labelled + DeepEval LLM-judged |
| Session Completion Rate | **>70%** | Analytics |
| User Satisfaction Score | **>4.2 / 5.0** | Post-session survey |
| Practitioner Routing Accuracy | **100%** | Paediatric + pregnancy + severity eval |

---

## Regulatory & Ethical Guardrails

1. **We never diagnose** — We assess, educate, and recommend. Diagnosis is the practitioner's domain.
2. **We never prescribe allopathic drugs** — Our output guardrails block any pharmaceutical prescribing.
3. **We always append the AYUSH disclaimer** — Every response includes the mandatory educational disclaimer.
4. **We always route emergencies** — Cardiac, stroke, breathing, poisoning → 112 immediately.
5. **We support, never replace, practitioners** — Complex cases always get routed to licensed AYUSH practitioners.
6. **We respect patient data** — PII masking, encrypted storage, consent-based data usage.

---

## Scope for Phase 1 (What We Built)

Phase 1 focuses exclusively on the **Naturopathy module** as the MVP, because:
- Nature Cure protocols are the most **universally applicable** (diet, exercise, hydrotherapy work for everyone)
- Lowest regulatory risk (lifestyle modifications, not herb prescriptions)
- Clearest outcome measurement (30-day protocol adherence is trackable)
- Foundation for Phase 2 (Ayurveda) and Phase 3 (Homeopathy)

---

> *"The body has the innate intelligence to heal itself. Our role is to identify and remove the obstacles to that healing."*
> — Henry Lindlahr, father of Nature Cure
