# CSE Study Management System

Welcome to your personal **Computer Science & Engineering (CSE) Study Management System**. This repository is architected to keep your lecture transcripts, notes, handwritten materials, past questions, code, and revision resources systematically organized and trackable throughout the semester.

---

## 📚 Subjects Overview

| # | Subject | Directory | Status Tracker | Focus Areas |
|---|---------|-----------|----------------|-------------|
| 1 | **OOPS with Java** | [`01_OOPS_Java`](file:///home/shwati-kumari/CSE-Study-Hub/01_OOPS_Java/README.md) | [View Checklist](file:///home/shwati-kumari/CSE-Study-Hub/01_OOPS_Java/README.md#topic-checklist) | OOP Principles, Java Runtime, Collections, Concurrency |
| 2 | **DSA with Java** | [`02_DSA_Java`](file:///home/shwati-kumari/CSE-Study-Hub/02_DSA_Java/README.md) | [View Checklist](file:///home/shwati-kumari/CSE-Study-Hub/02_DSA_Java/README.md#topic-checklist) | Algorithms, Trees, Graphs, DP, LeetCode Practice |
| 3 | **Operating Systems** | [`03_Operating_System`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/README.md) | [View Checklist](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/README.md#topic-checklist) | Process Scheduling, Synchronization, Memory, Numericals |
| 4 | **Discrete Mathematics** | [`04_Discrete_Mathematics`](file:///home/shwati-kumari/CSE-Study-Hub/04_Discrete_Mathematics/README.md) | [View Checklist](file:///home/shwati-kumari/CSE-Study-Hub/04_Discrete_Mathematics/README.md#topic-checklist) | Logic, Set Theory, Combinatorics, Graph Theory, Formulas |
| 5 | **Digital Electronics** | [`05_Digital_Electronics`](file:///home/shwati-kumari/CSE-Study-Hub/05_Digital_Electronics/README.md) | [View Checklist](file:///home/shwati-kumari/CSE-Study-Hub/05_Digital_Electronics/README.md#topic-checklist) | Boolean Logic, Combinational/Sequential Circuits, FSM |
| 6 | **Semester Resources** | [`06_Semester_Resources`](file:///home/shwati-kumari/CSE-Study-Hub/06_Semester_Resources/README.md) | [View Resources](file:///home/shwati-kumari/CSE-Study-Hub/06_Semester_Resources/README.md) | Master Syllabus, University Papers, Class Time Table |

📊 **Master Progress Tracker**: Track overall semester completion, revision cycles, and study hours in [`PROGRESS_TRACKER.md`](file:///home/shwati-kumari/CSE-Study-Hub/PROGRESS_TRACKER.md).

---

## 🗂️ Universal 7-Folder Architecture

Every subject follows the exact same 7-folder modular structure:

```
<Subject_Directory>/
├── 01_Video_Transcripts/          # Raw transcripts separated topic/lecture-wise
├── 02_Notes/                      # Step-by-step conceptual notes generated from transcripts
├── 03_Handwritten_Notes/          # Scanned handwritten classroom notes (PDFs/images)
├── 04_PYQs/                       # Previous Year Questions organized chapter-wise
├── 05_Important_Questions/        # High-probability exam questions & repeat questions
├── 06_Code_Examples/             # Working source code, simulations, and lab practicals
│   └── (Subject Specifics e.g., LeetCode / Numericals)
├── 07_Revision/                   # Quick revision notes, cheat-sheets, formula sheets
│   └── (Subject Specifics e.g., Formula_Sheet / Diagrams)
└── README.md                      # Subject guide, topic checklist, and progress tracker
```

---

## 📑 Standard Templates & Scaffolding

To maintain uniform documentation standards across all subjects, pre-built templates are available in the [`templates/`](file:///home/shwati-kumari/CSE-Study-Hub/templates) directory:

- 🎬 [Transcript Template](file:///home/shwati-kumari/CSE-Study-Hub/templates/TRANSCRIPT_TEMPLATE.md) (`templates/TRANSCRIPT_TEMPLATE.md`)
- 📝 [Notes Template](file:///home/shwati-kumari/CSE-Study-Hub/templates/NOTE_TEMPLATE.md) (`templates/NOTE_TEMPLATE.md`)
- 📑 [PYQ Chapter-wise Template](file:///home/shwati-kumari/CSE-Study-Hub/templates/PYQ_TEMPLATE.md) (`templates/PYQ_TEMPLATE.md`)
- ⚡ [Revision & Formula Sheet Template](file:///home/shwati-kumari/CSE-Study-Hub/templates/REVISION_TEMPLATE.md) (`templates/REVISION_TEMPLATE.md`)

---

## ⚙️ Standard Operating Procedures & Rules

### 1. 🎬 Video Transcripts
- **Separate Storage**: Save every lecture transcript in its own file under `01_Video_Transcripts/`.
- **Naming Standard**: Use clean, predictable filenames:  
  `T<Topic#>-L<Lecture#>_<Meaningful_Topic_Name>.txt` (or `.md`)  
  *Example*: `T02-L04_Polymorphism_and_Dynamic_Binding.md`
- **Topic-wise Hierarchy**: For large syllabi, group transcripts into topic subdirectories if needed (e.g., `01_Video_Transcripts/Unit_02_Process_Management/`).

### 2. 📝 Notes Creation
- **Source of Truth**: Notes are synthesized strictly from available transcripts and verified references.
- **Strict Anti-Hallucination**: Never invent definitions, proofs, or explanations missing from transcripts.
- **Format**:
  - Clear stepwise progression of concepts.
  - Highlight formal technical definitions.
  - Concrete syntax, dry runs, and diagram descriptions.
  - Important takeaways, edge cases, and exam tips.

### 3. 📑 Previous Year Questions (PYQs)
- Store university and entrance question papers subject-wise in `04_PYQs/`.
- Group questions chapter-wise / topic-wise.
- **Answers**: Keep question sets clean. Include answers or solution steps only when requested or designated in separate solution files (`PYQ_<Year>_Solutions.md`).
- **Repetition Tracking**: Tag questions that appear across multiple years (e.g., `[Repeated: 2021, 2023, 2024]`).

### 4. ⚡ Revision Material
- Quick cheat sheets and 1-2 page high-yield revision summaries in `07_Revision/`.
- Dedicated formula sheets for math/algorithm heavy subjects.
- Essential definitions, comparison tables (e.g., Process vs Thread, Mealy vs Moore), and time/space complexity matrices.

### 5. 🛡️ Safety & Integrity Rules
- Original user files are never overwritten, renamed, or deleted without explicit user confirmation.
- Study materials represent genuine course content (no dummy or fabricated questions/transcripts).
- All progress updates must reflect real study progress.
