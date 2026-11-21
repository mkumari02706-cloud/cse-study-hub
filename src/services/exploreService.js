const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../config/subjects');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const PROGRESS_FILE = path.join(DATA_DIR, 'explore_progress.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EXPLORE_TRACKS = [
  {
    id: 'ai_ml',
    title: 'Artificial Intelligence & Machine Learning',
    shortName: 'AI/ML',
    icon: '🤖',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    badge: 'Intelligence',
    duration: '12 Weeks',
    roles: ['ML Engineer', 'AI Research Engineer', 'Algorithm Specialist'],
    overview: 'Master foundational linear algebra, calculus, statistical modeling, classical machine learning algorithms, deep learning neural networks, and computer vision.',
    stages: [
      {
        stageNumber: 1,
        title: 'Foundations of Mathematics & Python',
        topics: [
          { id: 'aiml_1', name: 'Linear Algebra: Vectors, Matrices, Eigenvalues, SVD', desc: 'Matrix transformations, vector projections, and dimensionality reduction math.' },
          { id: 'aiml_2', name: 'Multivariate Calculus & Optimization (Gradient Descent)', desc: 'Partial derivatives, chain rule, SGD, Adam, and learning rate scheduling.' },
          { id: 'aiml_3', name: 'Probability, Random Variables & Bayes Theorem', desc: 'Distributions, expected value, maximum likelihood estimation (MLE).' },
          { id: 'aiml_4', name: 'Python Scientific Stack (NumPy, Pandas, Matplotlib, Seaborn)', desc: 'Vectorized computing, exploratory data analysis, and feature engineering.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Supervised & Unsupervised Learning',
        topics: [
          { id: 'aiml_5', name: 'Linear & Logistic Regression with Regularization (L1/L2)', desc: 'Loss functions, cost minimization, Ridge and Lasso penalties.' },
          { id: 'aiml_6', name: 'Decision Trees, Random Forests & Gradient Boosting (XGBoost)', desc: 'Entropy, Gini impurity, bagging, boosting, and ensemble variance reduction.' },
          { id: 'aiml_7', name: 'Support Vector Machines (SVM) & Kernel Trick', desc: 'Hyperplane optimization, soft margin, RBF kernel.' },
          { id: 'aiml_8', name: 'Clustering (K-Means, DBSCAN) & PCA Dimensionality Reduction', desc: 'Unsupervised grouping, elbow method, and covariance projection.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Deep Learning & Neural Networks',
        topics: [
          { id: 'aiml_9', name: 'Perceptrons, Multilayer Neural Networks & Backpropagation', desc: 'Feedforward architecture, activation functions (ReLU, Sigmoid, GeLU).' },
          { id: 'aiml_10', name: 'Convolutional Neural Networks (CNNs) & Computer Vision', desc: 'Convolutions, pooling, ResNet architecture, transfer learning.' },
          { id: 'aiml_11', name: 'Recurrent Neural Networks (RNNs) & LSTMs', desc: 'Sequence modeling, vanishing gradient problem, gates mechanisms.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'MLOps, Deployment & Capstone',
        topics: [
          { id: 'aiml_12', name: 'Model Evaluation Metrics (Precision, Recall, ROC-AUC, F1)', desc: 'Confusion matrix, class imbalance handling with SMOTE.' },
          { id: 'aiml_13', name: 'MLOps: Model Packaging, FastAPI Serving & Docker', desc: 'Serving models with REST endpoints, model latency benchmarking.' },
          { id: 'aiml_14', name: 'Capstone Project: End-to-End Image Classification System', desc: 'Production pipeline from raw dataset to cloud deployed inference API.' }
        ]
      }
    ]
  },
  {
    id: 'generative_ai',
    title: 'Generative AI & Large Language Models',
    shortName: 'GenAI',
    icon: '✨',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    badge: 'Generative',
    duration: '10 Weeks',
    roles: ['GenAI Engineer', 'LLM Architect', 'Prompt Engineer', 'AI Agent Developer'],
    overview: 'Dive deep into Attention mechanisms, Transformer architectures, Fine-tuning, Retrieval-Augmented Generation (RAG), and Autonomous Multi-Agent Swarms.',
    stages: [
      {
        stageNumber: 1,
        title: 'Transformers & Foundation Models',
        topics: [
          { id: 'genai_1', name: 'Self-Attention & Multi-Head Attention Mechanism', desc: 'Q, K, V matrix projections, scaled dot-product attention math.' },
          { id: 'genai_2', name: 'Transformer Architecture (Encoder-Decoder, BERT vs GPT)', desc: 'Positional encodings, layer normalization, auto-regressive decoding.' },
          { id: 'genai_3', name: 'Tokenization, Embeddings & Latent Space Geometry', desc: 'BPE tokenizers, cosine similarity in high-dimensional embedding spaces.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Prompt Engineering & Reasoning Frameworks',
        topics: [
          { id: 'genai_4', name: 'Chain-of-Thought (CoT) & Tree-of-Thought Prompting', desc: 'Zero-shot, few-shot, step-by-step reasoning scaffolds.' },
          { id: 'genai_5', name: 'Structured Outputs, Function Calling & Tool Use', desc: 'JSON schema enforcement and external API integration.' },
          { id: 'genai_6', name: 'System Prompts & Hallucination Mitigation Guardrails', desc: 'Strict negative constraints, constitutional AI, output sanitization.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Retrieval-Augmented Generation (RAG)',
        topics: [
          { id: 'genai_7', name: 'Vector Databases (Chroma, Pinecone, FAISS, pgvector)', desc: 'HNSW indexing, vector storage, and hybrid keyword-semantic search.' },
          { id: 'genai_8', name: 'Document Chunking Strategies & Re-ranking', desc: 'Recursive chunking, semantic boundary splits, Cohere re-rankers.' },
          { id: 'genai_9', name: 'Advanced RAG: Query Expansion & Self-RAG', desc: 'Sub-queries, hypothetical document embeddings (HyDE).' }
        ]
      },
      {
        stageNumber: 4,
        title: 'Autonomous Agents & Fine-Tuning',
        topics: [
          { id: 'genai_10', name: 'Autonomous Agent Loops (ReAct, Planning, Reflection)', desc: 'Reasoning and action cycles, short/long-term memory management.' },
          { id: 'genai_11', name: 'Parameter Efficient Fine-Tuning (LoRA, QLoRA)', desc: 'Low-rank adaptation adapters, 4-bit quantization, HuggingFace TRL.' },
          { id: 'genai_12', name: 'Capstone: Production Enterprise RAG Knowledge Base', desc: 'Multimodal document ingestion, citations, and conversation memory.' }
        ]
      }
    ]
  },
  {
    id: 'devops',
    title: 'DevOps & Site Reliability Engineering',
    shortName: 'DevOps',
    icon: '🚀',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
    badge: 'Infrastructure',
    duration: '10 Weeks',
    roles: ['DevOps Engineer', 'SRE', 'Cloud Infrastructure Engineer'],
    overview: 'Continuous integration, containerization with Docker, orchestration with Kubernetes, Infrastructure as Code with Terraform, and monitoring with Prometheus.',
    stages: [
      {
        stageNumber: 1,
        title: 'Linux Systems & Shell Automation',
        topics: [
          { id: 'devops_1', name: 'Linux System Administration & Kernel Architecture', desc: 'Process management (systemd), IPC, permissions, POSIX signals.' },
          { id: 'devops_2', name: 'Bash Scripting & CLI Automation Workflows', desc: 'Shell scripting, sed/awk text manipulation, cron scheduling.' },
          { id: 'devops_3', name: 'Networking Fundamentals (TCP/UDP, DNS, Subnets, Reverse Proxy)', desc: 'Nginx, TLS/SSL certificates, OSI model debugging with curl and netstat.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Containers & Docker Mastery',
        topics: [
          { id: 'devops_4', name: 'Docker Architecture, Namespaces & cgroups', desc: 'Linux kernel primitives powering isolated container processes.' },
          { id: 'devops_5', name: 'Optimized Multi-Stage Dockerfiles', desc: 'Alpine minimal images, layer caching, non-root user security.' },
          { id: 'devops_6', name: 'Docker Compose & Multi-Container Networks', desc: 'Service dependencies, shared volumes, local environment orchestration.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'CI/CD Pipelines & Infrastructure as Code',
        topics: [
          { id: 'devops_7', name: 'Git Advanced: Branching Models, Rebasing & Hooks', desc: 'Trunk-based development, pre-commit validation, merge strategies.' },
          { id: 'devops_8', name: 'GitHub Actions & CI/CD Pipelines', desc: 'Automated test matrices, secret management, Docker image publish.' },
          { id: 'devops_9', name: 'Terraform & Declarative Cloud Infrastructure', desc: 'State files, modules, providers, declarative AWS/GCP provisioning.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'Kubernetes & Observability',
        topics: [
          { id: 'devops_10', name: 'Kubernetes Core: Pods, Deployments, Services, Ingress', desc: 'Declarative YAML manifests, label selectors, ClusterIP and LoadBalancer.' },
          { id: 'devops_11', name: 'ConfigMaps, Secrets, PVC Storage & HPA Scaling', desc: 'Decoupling configuration, horizontal pod autoscaling under CPU load.' },
          { id: 'devops_12', name: 'Observability: Prometheus Metrics, Grafana & Loki Logs', desc: 'SLAs, SLOs, SLIs, log aggregation, alerting rules.' }
        ]
      }
    ]
  },
  {
    id: 'cybersecurity',
    title: 'Cybersecurity & Ethical Hacking',
    shortName: 'Cybersecurity',
    icon: '🛡️',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
    badge: 'Security',
    duration: '10 Weeks',
    roles: ['Security Analyst', 'Penetration Tester', 'AppSec Engineer', 'SOC Analyst'],
    overview: 'Learn defensive security, offensive exploitation, OWASP Top 10 vulnerabilities, applied cryptography, network packet analysis, and zero-trust architectures.',
    stages: [
      {
        stageNumber: 1,
        title: 'Foundations & Network Security',
        topics: [
          { id: 'sec_1', name: 'Threat Models, CIA Triad & Attack Vectors', desc: 'Confidentiality, Integrity, Availability, STRIDE threat modeling.' },
          { id: 'sec_2', name: 'Network Packet Sniffing & Wireshark Analysis', desc: 'Analyzing TCP 3-way handshakes, ARP spoofing, DNS exfiltration.' },
          { id: 'sec_3', name: 'Firewalls, IDS/IPS & Port Scanning (Nmap)', desc: 'Stateful packet inspection, scanning evasion, security boundaries.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Applied Cryptography',
        topics: [
          { id: 'sec_4', name: 'Symmetric vs Asymmetric Encryption (AES, RSA, ECC)', desc: 'Block ciphers, key generation, forward secrecy, hybrid encryption.' },
          { id: 'sec_5', name: 'Cryptographic Hashing & Salted Passwords (SHA-256, bcrypt)', desc: 'Collision resistance, rainbow tables, Argon2 password hashing.' },
          { id: 'sec_6', name: 'Public Key Infrastructure (PKI), TLS/SSL Handshake & JWT', desc: 'Digital certificates, certificate authorities, signature validation.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Web Application Security (OWASP Top 10)',
        topics: [
          { id: 'sec_7', name: 'SQL Injection (SQLi) Exploitation & Prepared Statements', desc: 'Union-based SQLi, blind injection, parameterized query defense.' },
          { id: 'sec_8', name: 'Cross-Site Scripting (XSS) & Content Security Policy (CSP)', desc: 'Stored, reflected, DOM-based XSS, input sanitization.' },
          { id: 'sec_9', name: 'CSRF, SSRF, Broken Access Control & IDOR', desc: 'Same-site cookies, anti-CSRF tokens, server-side request forgery.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'System Hardening & Secure Engineering',
        topics: [
          { id: 'sec_10', name: 'Linux OS Hardening, SSH Security & Least Privilege', desc: 'Disabling root login, auditd, fail2ban, principle of least privilege.' },
          { id: 'sec_11', name: 'Zero-Trust Architecture & IAM Governance', desc: 'Micro-segmentation, identity-based access, multi-factor authentication.' },
          { id: 'sec_12', name: 'Vulnerability Assessment & Burp Suite Lab', desc: 'Intercepting proxies, fuzzing parameters, security audit reporting.' }
        ]
      }
    ]
  },
  {
    id: 'web_development',
    title: 'Modern Full-Stack Web Development',
    shortName: 'Web Dev',
    icon: '🌐',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    badge: 'Full Stack',
    duration: '10 Weeks',
    roles: ['Full-Stack Developer', 'Frontend Architect', 'Backend Engineer'],
    overview: 'Deep architectural understanding of HTML5/CSS3, JavaScript ESNext, Node.js backend systems, relational databases, REST & GraphQL APIs, and frontend state management.',
    stages: [
      {
        stageNumber: 1,
        title: 'Modern Frontend Architecture',
        topics: [
          { id: 'web_1', name: 'HTML5 Semantic Structure & Web Accessibility (a11y)', desc: 'ARIA landmarks, accessible forms, SEO metadata, web standards.' },
          { id: 'web_2', name: 'CSS Grid, Flexbox, Custom Properties & Responsive Design', desc: 'Fluid typography, container queries, dark/light theme systems.' },
          { id: 'web_3', name: 'JavaScript Deep Dive: Event Loop, Closures & Promises', desc: 'Microtasks vs macrotasks, prototypical inheritance, async/await.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Backend Systems & API Design',
        topics: [
          { id: 'web_4', name: 'Node.js Runtime: Libuv, Event-Driven I/O & Streams', desc: 'Non-blocking architecture, memory buffer processing, worker threads.' },
          { id: 'web_5', name: 'RESTful API Architecture & Express Middleware Pipeline', desc: 'Idempotency, HTTP status codes, validation middleware, rate limiting.' },
          { id: 'web_6', name: 'Authentication: Session vs JWT, OAuth 2.0 & Cookies', desc: 'HttpOnly secure cookies, token refresh rotation, Google OAuth.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Databases & Performance Caching',
        topics: [
          { id: 'web_7', name: 'Relational Database Design & Normalization (PostgreSQL/MySQL)', desc: '1NF to BCNF, ACID transactions, foreign keys, indexing strategies.' },
          { id: 'web_8', name: 'Query Optimization & B-Tree Indexing Deep Dive', desc: 'EXPLAIN ANALYZE, composite indexes, query cost reduction.' },
          { id: 'web_9', name: 'In-Memory Caching with Redis', desc: 'Cache-aside pattern, TTL expiration, cache invalidation strategies.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'Component Architecture & Deployment',
        topics: [
          { id: 'web_10', name: 'Frontend State Management & Component Lifecycles', desc: 'Reactive state primitives, unidirectional data flow, virtual DOM.' },
          { id: 'web_11', name: 'WebSockets & Real-Time Bidirectional Communication', desc: 'Socket.IO, event broadcasts, live status updates.' },
          { id: 'web_12', name: 'Capstone: Production High-Performance Web Application', desc: 'Lighthouse 95+ score, CDN asset delivery, production deployment.' }
        ]
      }
    ]
  },
  {
    id: 'cloud_computing',
    title: 'Cloud Computing Architecture',
    shortName: 'Cloud',
    icon: '☁️',
    color: '#0284c7',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    badge: 'Cloud Systems',
    duration: '10 Weeks',
    roles: ['Cloud Architect', 'Cloud Solutions Specialist', 'Enterprise Infrastructure Lead'],
    overview: 'Design highly available, fault-tolerant, scalable cloud infrastructure across AWS, GCP, and Azure using serverless, microservices, and VPC networking.',
    stages: [
      {
        stageNumber: 1,
        title: 'Cloud Core Concepts & Global Infrastructure',
        topics: [
          { id: 'cloud_1', name: 'IaaS vs PaaS vs SaaS & Shared Responsibility Model', desc: 'Cloud service models, vendor boundaries, compliance fundamentals.' },
          { id: 'cloud_2', name: 'Virtual Private Cloud (VPC), Subnets, Route Tables & NAT', desc: 'Isolated cloud networking, public vs private subnets, CIDR blocks.' },
          { id: 'cloud_3', name: 'Identity & Access Management (IAM): Roles, Policies & MFA', desc: 'Least privilege access control, service roles, temporary credentials.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Compute & Storage Systems',
        topics: [
          { id: 'cloud_4', name: 'Virtual Compute (EC2) & Auto-Scaling Groups', desc: 'Instance types, user data bootstrap, launch templates, health checks.' },
          { id: 'cloud_5', name: 'Object Storage (S3) vs Block Storage (EBS) vs Network (EFS)', desc: 'Lifecycle policies, bucket versioning, high-throughput storage.' },
          { id: 'cloud_6', name: 'Application Load Balancers (ALB) & Path-Based Routing', desc: 'Traffic distribution, sticky sessions, SSL offloading.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Serverless & Cloud Databases',
        topics: [
          { id: 'cloud_7', name: 'Serverless Functions (AWS Lambda / Google Cloud Functions)', desc: 'Event-driven triggers, cold starts, concurrency controls.' },
          { id: 'cloud_8', name: 'Managed Relational Databases (RDS / Cloud SQL) & Read Replicas', desc: 'Multi-AZ failover, automated backups, horizontal read scaling.' },
          { id: 'cloud_9', name: 'NoSQL Cloud Databases (DynamoDB / Firestore)', desc: 'Partition keys, sort keys, global secondary indexes, single-digit ms latency.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'High Availability & Disaster Recovery',
        topics: [
          { id: 'cloud_10', name: 'Multi-Region Architecture & Disaster Recovery (RPO/RTO)', desc: 'Pilot light, warm standby, multi-site active/active configurations.' },
          { id: 'cloud_11', name: 'Cloud Security: WAF, Shield DDoS Protection & KMS Encryption', desc: 'Envelope encryption, customer managed keys, edge filtering.' },
          { id: 'cloud_12', name: 'Capstone: 99.99% SLA Cloud Architecture Blueprint', desc: 'Architecting an enterprise web service across multiple availability zones.' }
        ]
      }
    ]
  },
  {
    id: 'data_science',
    title: 'Data Science & Big Data Engineering',
    shortName: 'Data Science',
    icon: '📊',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    badge: 'Data Systems',
    duration: '11 Weeks',
    roles: ['Data Scientist', 'Data Engineer', 'Quantitative Analyst', 'BI Specialist'],
    overview: 'Master statistical inference, hypothesis testing, ETL data pipelines, distributed processing with Apache Spark, and interactive predictive modeling.',
    stages: [
      {
        stageNumber: 1,
        title: 'Statistical Inference & Exploratory Analysis',
        topics: [
          { id: 'ds_1', name: 'Descriptive & Inferential Statistics, Central Limit Theorem', desc: 'Skewness, kurtosis, sampling distributions, confidence intervals.' },
          { id: 'ds_2', name: 'Hypothesis Testing (Z-Test, T-Test, ANOVA, Chi-Square)', desc: 'Null hypothesis, p-values, Type I & Type II error trade-offs.' },
          { id: 'ds_3', name: 'Advanced Feature Engineering & Missing Data Imputation', desc: 'One-hot vs target encoding, KNN imputation, outlier handling (IQR).' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Data Pipelines & Distributed Computing',
        topics: [
          { id: 'ds_4', name: 'Data Warehousing vs Data Lakes (Snowflake, BigQuery, Delta Lake)', desc: 'Star schema, snowflake schema, columnar storage formats (Parquet).' },
          { id: 'ds_5', name: 'Distributed Data Processing with Apache Spark & PySpark', desc: 'RDDs, DataFrames, lazy evaluation, cluster shuffle optimization.' },
          { id: 'ds_6', name: 'ETL / ELT Pipeline Orchestration (Airflow / Prefect)', desc: 'Directed acyclic graphs (DAGs), task dependencies, retry policies.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Predictive Modeling & Time Series',
        topics: [
          { id: 'ds_7', name: 'Time-Series Analysis (ARIMA, SARIMA, Prophet)', desc: 'Stationarity testing, autocorrelation (ACF/PACF), seasonal trends.' },
          { id: 'ds_8', name: 'Customer Segmentation & Recommender Systems (Collaborative Filtering)', desc: 'Matrix factorization, SVD, cosine item similarity.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'Data Storytelling & Production Analytics',
        topics: [
          { id: 'ds_9', name: 'A/B Testing Frameworks & Sample Size Power Calculation', desc: 'Minimum detectable effect, statistical power, experiment guardrails.' },
          { id: 'ds_10', name: 'Interactive Dashboards (Streamlit, Tableau & PowerBI)', desc: 'Executive metric cards, interactive filtering, stakeholder communication.' },
          { id: 'ds_11', name: 'Capstone: End-to-End Predictive Analytics Pipeline', desc: 'Real-time data ingestion, transformation, model scoring, and dashboard.' }
        ]
      }
    ]
  },
  {
    id: 'dsa',
    title: 'Data Structures & Advanced Algorithms',
    shortName: 'DSA',
    icon: '⚡',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    badge: 'Algorithms',
    duration: '12 Weeks',
    roles: ['Software Engineer', 'Systems Architect', 'Competitive Programmer', 'FAANG Candidate'],
    overview: 'Systematic mastery of coding interview patterns: Two Pointers, Sliding Window, Monotonic Stacks, Trees, Graphs, Dynamic Programming, and Bitmasking.',
    stages: [
      {
        stageNumber: 1,
        title: 'Linear Data Structures & Core Patterns',
        topics: [
          { id: 'dsa_1', name: 'Two Pointers & Sliding Window Patterns (Fixed & Dynamic)', desc: 'Optimizing $O(N^2)$ brute force to $O(N)$ linear scans.' },
          { id: 'dsa_2', name: 'Fast & Slow Pointers (Cycle Detection & Middle Finding)', desc: "Floyd's cycle detection, palindrome linked list verification." },
          { id: 'dsa_3', name: 'Monotonic Stack & Monotonic Queue', desc: 'Next Greater Element, Largest Rectangle in Histogram in $O(N)$.' },
          { id: 'dsa_4', name: 'Binary Search on Answer & Rotated Arrays', desc: 'Predicate functions, search bounds, peak element detection.' }
        ]
      },
      {
        stageNumber: 2,
        title: 'Trees, Heaps & Tries',
        topics: [
          { id: 'dsa_5', name: 'Tree Traversals (In, Pre, Post, Level-Order, Morris Traversal)', desc: 'Iterative stack simulation, $O(1)$ auxiliary space Morris traversal.' },
          { id: 'dsa_6', name: 'Lowest Common Ancestor (LCA) & Path Sum Problems', desc: 'Recursive subtree aggregation, backtracking tree paths.' },
          { id: 'dsa_7', name: 'Min/Max Heaps, Top-K Elements & Running Median', desc: 'Dual-heap balance, $O(N)$ heapify, priority queues in Java/C++.' },
          { id: 'dsa_8', name: 'Trie (Prefix Tree) Implementation & Autocomplete', desc: 'Character arrays, prefix search, word break using Tries.' }
        ]
      },
      {
        stageNumber: 3,
        title: 'Graphs & Disjoint Set Union',
        topics: [
          { id: 'dsa_9', name: 'Graph BFS/DFS & Bipartite Graph Detection', desc: 'Cycle detection in directed/undirected graphs, 2-coloring.' },
          { id: 'dsa_10', name: 'Topological Sort (Kahn’s Algorithm & DFS Stack)', desc: 'Course schedule ordering, dependency resolution.' },
          { id: 'dsa_11', name: 'Shortest Path: Dijkstra’s & Bellman-Ford Algorithms', desc: 'Priority queue optimization, negative edge cycle detection.' },
          { id: 'dsa_12', name: 'Disjoint Set Union (DSU) with Path Compression & Kruskal MST', desc: 'Near $O(1)$ amortized disjoint set merging, minimum spanning trees.' }
        ]
      },
      {
        stageNumber: 4,
        title: 'Dynamic Programming & Advanced Patterns',
        topics: [
          { id: 'dsa_13', name: '1D DP & Subsequence Problems (House Robber, LIS)', desc: 'State definition, recurrence relation, space optimization to $O(1)$.' },
          { id: 'dsa_14', name: '2D DP: 0/1 Knapsack, LCS & Matrix Chain Multiplication', desc: 'Grid DP, string edit distance, boundary condition memoization.' },
          { id: 'dsa_15', name: 'Interval DP & DP with Bitmasking', desc: 'Subset state encoding with binary integers, Traveling Salesperson.' },
          { id: 'dsa_16', name: 'Capstone: 50 High-Frequency LeetCode Pattern Review', desc: 'Comprehensive practice marathon across all 15 algorithmic templates.' }
        ]
      }
    ]
  }
];

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({}, null, 2), 'utf-8');
    return {};
  }
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getAllTracks() {
  const progress = loadProgress();
  return EXPLORE_TRACKS.map(track => {
    const completedIds = progress[track.id] || [];
    const allTopics = track.stages.flatMap(s => s.topics);
    const total = allTopics.length;
    const completed = completedIds.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      ...track,
      completedTopics: completedIds,
      totalTopics: total,
      completedCount: completed,
      percentage
    };
  });
}

function getTrackById(trackId) {
  const tracks = getAllTracks();
  return tracks.find(t => t.id === trackId) || null;
}

function toggleMilestone(trackId, milestoneId, forceStatus = null) {
  const progress = loadProgress();
  if (!progress[trackId]) {
    progress[trackId] = [];
  }

  const list = progress[trackId];
  const idx = list.indexOf(milestoneId);
  let isCompleted = false;

  if (forceStatus === true) {
    if (idx === -1) list.push(milestoneId);
    isCompleted = true;
  } else if (forceStatus === false) {
    if (idx > -1) list.splice(idx, 1);
    isCompleted = false;
  } else if (idx > -1) {
    list.splice(idx, 1);
    isCompleted = false;
  } else {
    list.push(milestoneId);
    isCompleted = true;
  }

  progress[trackId] = list;
  saveProgress(progress);

  const track = getTrackById(trackId);
  return {
    trackId,
    milestoneId,
    isCompleted,
    trackPercentage: track ? track.percentage : 0,
    completedCount: list.length
  };
}

function resetTrackProgress(trackId) {
  const progress = loadProgress();
  progress[trackId] = [];
  saveProgress(progress);

  const track = getTrackById(trackId);
  return {
    trackId,
    trackPercentage: track ? track.percentage : 0,
    completedCount: 0
  };
}

module.exports = {
  EXPLORE_TRACKS,
  getAllTracks,
  getTrackById,
  toggleMilestone,
  resetTrackProgress
};
