# 💻 Operating Systems - Study Hub

Welcome to the **Operating Systems** study portal. This subject covers fundamental kernel architectures, process and memory abstractions, concurrency, deadlocks, and disk storage mechanisms, along with important numerical problems.

---

## 📂 Subject Directory Structure

- [`01_Video_Transcripts/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/01_Video_Transcripts) : Raw lecture transcripts stored lecture-by-lecture.
- [`02_Notes/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/02_Notes) : Step-by-step conceptual notes with OS architectural diagrams.
- [`03_Handwritten_Notes/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/03_Handwritten_Notes) : Scanned classroom notes, timing charts, and state transitions.
- [`04_PYQs/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/04_PYQs) : Past exam papers organized chapter-wise.
- [`05_Important_Questions/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/05_Important_Questions) : Recurring university questions (e.g., Banker's, Peterson's, TLB).
- [`06_Code_Examples/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/06_Code_Examples) : POSIX C / Java systems programming (fork, threads, semaphores).
  - [`Numericals/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/06_Code_Examples/Numericals) : Solved numerical practice files and simulation scripts.
- [`07_Revision/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/07_Revision) : Comparison tables (Process vs Thread, Paging vs Segmentation) and summaries.
  - [`Numericals/`](file:///home/shwati-kumari/CSE-Study-Hub/03_Operating_System/07_Revision/Numericals) : Formula summaries for CPU scheduling, memory, and disk math.

---

## 📋 Topic Checklist

### Unit 1: Introduction to Operating Systems
- [ ] OS Roles, Objectives, and Evolution
- [ ] Dual-mode operation (User mode vs Kernel mode), Mode Bit
- [ ] System Calls: Types, mechanisms, trap execution, parameter passing
- [ ] Operating System Structures: Monolithic, Layered, Microkernel, Hybrid

### Unit 2: Process Management & Threads
- [ ] Process concept, Process Control Block (PCB), Context Switch overhead
- [ ] Process State Diagram (New, Ready, Running, Waiting, Terminated)
- [ ] Process Creation (`fork()`, `exec()`, `wait()`, `exit()`), Zombie and Orphan processes
- [ ] Inter-Process Communication (IPC): Shared Memory vs Message Passing
- [ ] Threads: User-level vs Kernel-level threads, Multithreading models (Many-to-One, One-to-One, Many-to-Many)

### Unit 3: CPU Scheduling (Concepts & Numericals)
- [ ] Preemptive vs Non-preemptive scheduling
- [ ] Performance criteria: Turnaround time, Waiting time, Response time, Throughput
- [ ] FCFS (First-Come, First-Served) & Convoy effect
- [ ] SJF (Shortest Job First) & SRTF (Shortest Remaining Time First)
- [ ] Round Robin (RR) Scheduling & Time Quantum optimization
- [ ] Priority Scheduling (with aging to avoid starvation)
- [ ] Multilevel Queue and Multilevel Feedback Queue Scheduling

### Unit 4: Process Synchronization & Concurrency
- [ ] Race Condition & Critical Section Problem (3 Requirements: Mutual Exclusion, Progress, Bounded Waiting)
- [ ] Peterson's Solution for 2 processes
- [ ] Hardware Synchronization: TestAndSet, CompareAndSwap
- [ ] Mutex Locks vs Semaphores (Binary vs Counting Semaphores)
- [ ] Classic Problems of Synchronization:
  - [ ] Producer-Consumer Problem (Bounded Buffer)
  - [ ] Readers-Writers Problem
  - [ ] Dining Philosophers Problem
- [ ] Monitors and Condition Variables

### Unit 5: Deadlocks
- [ ] 4 Necessary Coffman Conditions: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait
- [ ] Resource Allocation Graph (RAG) and Cycle Detection
- [ ] Deadlock Handling Strategies: Ostrich Algorithm, Prevention, Avoidance, Detection & Recovery
- [ ] Deadlock Avoidance: Banker's Algorithm (Safety & Resource-Request Algorithms with numericals)
- [ ] Deadlock Detection and Recovery mechanisms

### Unit 6: Main Memory Management
- [ ] Logical vs Physical Address space, Memory Management Unit (MMU)
- [ ] Contiguous Allocation: Fixed vs Variable Partitioning, Allocation strategies (First Fit, Best Fit, Worst Fit)
- [ ] Fragmentation: Internal vs External Fragmentation, Compaction
- [ ] Paging: Concept, Page table architecture, Hardware support
- [ ] Translation Lookaside Buffer (TLB): Effective Memory Access Time (EMAT) numericals
- [ ] Hierarchical Paging, Inverted Page Tables, Segmentation

### Unit 7: Virtual Memory Management
- [ ] Demand Paging, Page Fault mechanism, Effective Access Time calculations
- [ ] Page Replacement Algorithms:
  - [ ] FIFO (First-In, First-Out) & Belady's Anomaly
  - [ ] Optimal Page Replacement (OPT / MIN)
  - [ ] Least Recently Used (LRU) and approximations (Second Chance / Clock algorithm)
- [ ] Allocation of Frames, Thrashing, Working Set Model

### Unit 8: Secondary Storage & File Systems
- [ ] Disk Structure, Physical characteristics (Seek Time, Rotational Latency, Transfer Time)
- [ ] Disk Scheduling Algorithms: FCFS, SSTF, SCAN (Elevator), C-SCAN, LOOK, C-LOOK
- [ ] File Concept, Access Methods (Sequential, Direct), Directory structures
- [ ] File Allocation Methods: Contiguous, Linked List, Indexed Allocation (Inode structure)
- [ ] Free Space Management: Bit vector, Linked list, Grouping, Counting

---

## 📌 Subject Progress Matrix

| Unit | Transcripts | Notes | Numericals | PYQs | Revision |
|:-----|:-----------:|:-----:|:----------:|:----:|:--------:|
| Unit 1: Introduction | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Unit 2: Processes & Threads | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Unit 3: CPU Scheduling | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Unit 4: Synchronization | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Unit 5: Deadlocks | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Unit 6: Main Memory & TLB | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Unit 7: Virtual Memory | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Unit 8: Storage & Disk | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
