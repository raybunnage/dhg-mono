# Code Continuous Monitoring System
## Vision & Implementation Guide

*Last Updated: June 8, 2025*

---

## 🎯 **Vision Statement**

The **Code Continuous Monitoring System** provides automated, real-time insights into code quality, architecture patterns, and technical debt across the DHG monorepo. Unlike documentation monitoring (which tracks content freshness), code monitoring focuses on **code health, maintainability, and adherence to project standards**.

### **Core Objectives**

1. **Early Detection**: Identify code quality issues before they become technical debt
2. **Pattern Enforcement**: Ensure adherence to architectural patterns (singleton services, proper imports, etc.)
3. **Refactoring Guidance**: Suggest opportunities for shared service extraction and code improvements
4. **Trend Analysis**: Track code health metrics over time to inform technical decisions
5. **Automated Standards**: Continuously validate CLAUDE.md guidelines compliance

---

## 🏗️ **System Architecture**

### **Database Foundation**

The system uses a dedicated set of tables in the `sys_monitoring_*` namespace:

```sql
-- Core monitoring execution tracking
sys_monitoring_runs          -- Each scan/monitoring session
sys_monitoring_findings      -- Individual issues detected
sys_monitoring_metrics       -- Quantitative measurements over time
sys_monitoring_configs       -- Folder-specific monitoring rules
```

**Key Design Principles:**
- **Separation of Concerns**: Code monitoring (sys_*) vs Documentation monitoring (doc_*)
- **Granular Tracking**: Individual findings linked to specific files and lines
- **Historical Trends**: Metrics tracked over time for analysis
- **Configurable Rules**: Per-folder monitoring configurations

### **CLI Pipeline Location**

```
scripts/cli-pipeline/monitoring/
├── monitoring-cli.sh          # Main CLI interface
├── folder-monitor.ts          # Core monitoring logic
├── health-check.sh           # Pipeline health validation
└── package.json              # Dependencies
```

---

## 🔍 **Monitoring Categories**

### **1. Architecture Compliance**
- **Singleton Pattern Enforcement**: Detect direct `createClient()` usage
- **Import Pattern Validation**: Ensure proper shared service imports  
- **Service Extraction Opportunities**: Identify code that should be in `packages/shared/services/`

### **2. Code Quality Metrics**
- **File Size Analysis**: Flag files > 300 lines for potential splitting
- **Export Density**: Files with > 5 exports as shared service candidates  
- **Complexity Indicators**: Multiple responsibilities in single files

### **3. Standards Compliance**
- **CLAUDE.md Adherence**: Validate project conventions
- **Logging Standards**: Detect inappropriate `console.log` usage
- **TypeScript Best Practices**: Explicit typing, error handling

### **4. Technical Debt Detection**
- **Hardcoded Credentials**: Security anti-patterns
- **Deprecated Patterns**: Old import styles, outdated libraries
- **Missing Tests**: Code without corresponding test coverage

---

## 📊 **Current Implementation Status**

### ✅ **Implemented Features**

1. **Basic Folder Scanning**
   ```bash
   ./scripts/cli-pipeline/monitoring/monitoring-cli.sh scan apps/dhg-hub
   ```

2. **Database Schema**: Complete tables for tracking runs, findings, and metrics

3. **CLI Commands Available**:
   - `scan <folder>` - One-time analysis
   - `watch <folder>` - Continuous monitoring
   - `quick <folder>` - Last 24h changes only
   - `report <folder>` - Detailed analysis with DB persistence
   - `history <folder>` - Historical trend data
   - `trends <folder>` - Metric analysis over time

4. **Automated Detection**:
   - Large files (>300 lines)
   - Multiple exports (>5 per file)  
   - Direct Supabase client creation
   - Excessive console.log usage
   - New/modified files tracking

### ⚠️ **Current Gaps & Next Steps**

1. **No Active Data Population**
   - Tables exist but appear to have no monitoring runs yet
   - Need to establish regular scanning schedules
   - Missing automated triggers for continuous monitoring

2. **Limited Rule Coverage**
   - Basic patterns implemented, need comprehensive CLAUDE.md rules
   - Missing architectural pattern detection
   - No shared service extraction suggestions

3. **No Alerting System**
   - Findings are detected but not actively reported
   - No integration with development workflow
   - Missing severity-based notifications

---

## 🚀 **Implementation Roadmap**

### **Phase 1: Foundation Activation** (Immediate)

1. **Populate Initial Data**
   ```bash
   # Run baseline scans for all major folders
   ./monitoring-cli.sh report apps/dhg-hub
   ./monitoring-cli.sh report packages/shared/services  
   ./monitoring-cli.sh report scripts/cli-pipeline
   ```

2. **Establish Regular Monitoring**
   - Set up scheduled scans (daily/weekly)
   - Configure folder-specific rules in `sys_monitoring_configs`
   - Define severity thresholds for different finding types

3. **Validate Current Pipeline**
   ```bash
   ./monitoring-cli.sh health-check
   ```

### **Phase 2: Enhanced Detection** (Next Sprint)

1. **CLAUDE.md Rule Integration**
   - File placement validation (no files in root)
   - Import pattern compliance
   - Singleton service usage verification
   - TypeScript best practices enforcement

2. **Shared Service Detection**
   - Identify duplicate functionality across apps
   - Suggest common utilities for extraction
   - Flag non-singleton database clients

3. **Architecture Pattern Validation**
   - Enforce correct adapter patterns
   - Validate environment variable handling
   - Check for hardcoded credentials

### **Phase 3: Workflow Integration** (Future)

1. **Git Integration**
   - Pre-commit hooks for real-time validation
   - Pull request analysis and reporting
   - Automatic issue creation for critical findings

2. **Dashboard & Reporting**
   - Visual trend analysis
   - Code health scoring
   - Team/folder performance metrics

3. **Advanced Analytics**
   - Predictive technical debt analysis
   - Refactoring impact assessment
   - Architecture evolution tracking

---

## 🔧 **Configuration Examples**

### **Monitoring Configuration Schema**
```json
{
  "name": "dhg-hub-monitoring",
  "folder_path": "apps/dhg-hub",
  "config": {
    "schedule": "daily",
    "rules": {
      "max_file_lines": 300,
      "max_exports_per_file": 5,
      "require_tests": true,
      "enforce_singleton_patterns": true,
      "check_imports": ["@shared/services", "@shared/components"]
    },
    "severity_thresholds": {
      "file_size_warning": 200,
      "file_size_error": 400,
      "console_log_warning": 3,
      "console_log_error": 10
    },
    "exclude_patterns": [
      "**/*.test.ts",
      "**/*.spec.ts", 
      "**/node_modules/**"
    ]
  }
}
```

### **Example Monitoring Run**
```bash
# Full analysis with database persistence
./monitoring-cli.sh report packages/shared/services

# Quick development check
./monitoring-cli.sh quick apps/dhg-hub --since 1d

# Continuous watching during development
./monitoring-cli.sh watch packages/shared/services --interval 30
```

---

## 📈 **Metrics & KPIs**

### **Code Health Metrics**
- **Technical Debt Score**: Weighted sum of findings by severity
- **Architecture Compliance**: % of files following patterns
- **Test Coverage Proxy**: Files with/without corresponding tests
- **Shared Service Adoption**: Usage of singleton patterns vs direct clients

### **Trend Analysis**
- **Quality Trajectory**: Are issues increasing or decreasing?
- **Refactoring Velocity**: How quickly are suggestions addressed?
- **Pattern Adoption**: Growing usage of recommended patterns
- **Folder Health Rankings**: Comparative analysis across modules

### **Development Insights**
- **Hotspot Detection**: Folders with frequent quality issues
- **Contributor Patterns**: Code quality by development area
- **Architectural Drift**: Deviation from established patterns
- **Maintenance Burden**: Files requiring frequent fixes

---

## 🎯 **Success Criteria**

### **Short Term (1 Month)**
- [ ] All major folders have baseline monitoring data
- [ ] Daily automated scans running successfully  
- [ ] 80% reduction in direct Supabase client creation
- [ ] Clear trend data for code quality metrics

### **Medium Term (3 Months)**
- [ ] Zero hardcoded credentials in monitored code
- [ ] 90% compliance with CLAUDE.md patterns
- [ ] Automated shared service extraction suggestions
- [ ] Integration with development workflow

### **Long Term (6 Months)**
- [ ] Predictive technical debt analysis
- [ ] Automated code quality gates
- [ ] Team dashboard for code health tracking
- [ ] Measurable improvement in code maintainability

---

## 🔗 **Related Systems**

### **Documentation Continuous Monitoring**
- **Location**: `doc_continuous_tracking`, `doc_continuous_updates` tables
- **Purpose**: Content freshness, documentation updates
- **Scope**: Markdown files, README updates, technical documentation
- **Distinction**: Content management vs code quality

### **Integration Points**
- **Shared Database**: Common `sys_` prefix for system-wide monitoring
- **CLI Pipeline Structure**: Consistent command patterns
- **Metrics Dashboard**: Combined view of code and docs health
- **Alert Systems**: Unified notification framework

---

## 📚 **Quick Reference**

### **Essential Commands**
```bash
# Initial setup and baseline
./monitoring-cli.sh report packages/shared/services

# Development workflow  
./monitoring-cli.sh quick apps/dhg-hub
./monitoring-cli.sh scan apps/dhg-admin-suite --save

# Analysis and trends
./monitoring-cli.sh history packages/shared/services --days 30
./monitoring-cli.sh trends apps/dhg-hub

# System health
./monitoring-cli.sh health-check
```

### **Database Queries**
```sql
-- Recent monitoring activity
SELECT folder_path, status, started_at, findings->>'total_issues' as issues
FROM sys_monitoring_runs 
ORDER BY started_at DESC LIMIT 10;

-- Top finding types
SELECT finding_type, COUNT(*) as count, severity
FROM sys_monitoring_findings 
GROUP BY finding_type, severity
ORDER BY count DESC;

-- Folder health trends
SELECT folder_path, metric_type, AVG(metric_value) as avg_value
FROM sys_monitoring_metrics 
WHERE recorded_at > NOW() - INTERVAL '30 days'
GROUP BY folder_path, metric_type;
```

---

*This document is part of the DHG Monorepo's continuously updated documentation system. It will be automatically refreshed as the monitoring system evolves and new patterns are established.*