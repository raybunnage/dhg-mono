# Supabase Free Plan Optimization Guide

**Status**: ✅ Implemented and Ready to Use  
**Created**: June 11, 2025  
**Last Updated**: June 11, 2025  
**Category**: Living Document - Performance & Cost Optimization

## 🎯 Overview

This living document tracks the Supabase free plan optimization tools that help you stay within the free tier limits and avoid the $25/month Pro plan upgrade. The primary constraint is **5GB egress bandwidth per month**.

## 🛠️ Implementation Status

### ✅ Completed Components

1. **Caching Service** (`packages/shared/services/supabase-cache.ts`)
   - In-memory cache implementation
   - TTL-based expiration
   - Cache statistics tracking
   - Can reduce API calls by 70%+

2. **Optimization Analysis Tool** (`scripts/cli-pipeline/database/optimize-for-free-plan.ts`)
   - Bandwidth usage analysis
   - Table consolidation recommendations
   - Query optimization suggestions
   - Archival strategies

## 📊 Current Database Status

- **Total Tables**: 135 (up from 57)
- **High-Risk Tables**: 188 dev_tasks records with potential large text fields
- **Bandwidth Threshold**: 5GB per month
- **Deadline**: July 8, 2025 (Fair Use Policy enforcement begins)

## 🚀 How to Use the Tools

### 1. Run Optimization Analysis

```bash
# Analyze current usage and get recommendations
ts-node scripts/cli-pipeline/database/optimize-for-free-plan.ts
```

This provides:
- Archive recommendations for old data
- Query optimization patterns
- Table consolidation suggestions
- Bandwidth usage patterns

### 2. Implement Caching

```typescript
import { cachedQuery } from '@shared/services/supabase-cache';

// Before (high bandwidth)
const { data } = await supabase.from('dev_tasks').select('*');

// After (70% reduction)
const data = await cachedQuery(
  'dev-tasks-active',
  async () => {
    const { data } = await supabase
      .from('dev_tasks')
      .select('id, title, status') // Only needed fields
      .eq('status', 'in_progress');
    return data;
  },
  5 * 60 * 1000 // 5 minute cache
);
```

### 3. Cache Management

```typescript
import { SupabaseCache } from '@shared/services/supabase-cache';

const cache = SupabaseCache.getInstance();

// Check cache statistics
const stats = cache.getStats();
console.log(`Cache entries: ${stats.entries}`);
console.log(`Approximate size: ${stats.approximateSizeKB}KB`);

// Clear specific cache
cache.clear('dev-tasks-active');

// Clear all cache
cache.clear();
```

## 🎯 Immediate Actions Required

### Priority 1: Quick Wins (Do Today)
- [ ] Disable real-time subscriptions (saves 50%+ bandwidth)
- [ ] Implement caching on high-frequency queries
- [ ] Update all `SELECT *` to specific column selections

### Priority 2: This Week
- [ ] Archive dev_tasks older than 30 days
- [ ] Consolidate command tracking tables
- [ ] Implement pagination (50-100 records per request)

### Priority 3: Before July 8
- [ ] Reduce table count from 135 to ~80
- [ ] Move large text processing to local/edge functions
- [ ] Implement request batching

## 📈 Bandwidth Optimization Strategies

### 1. Query Optimization
```typescript
// ❌ Bad - Downloads entire record
const { data } = await supabase.from('dev_tasks').select('*');

// ✅ Good - Only needed fields
const { data } = await supabase
  .from('dev_tasks')
  .select('id, title, status, priority');

// ✅ Better - With filtering
const { data } = await supabase
  .from('dev_tasks')
  .select('id, title')
  .eq('status', 'pending')
  .limit(50);
```

### 2. Caching Patterns
```typescript
// Cache user preferences (long TTL)
const prefs = await cachedQuery('user-prefs', fetchPrefs, 60 * 60 * 1000);

// Cache active tasks (short TTL)
const tasks = await cachedQuery('active-tasks', fetchTasks, 5 * 60 * 1000);

// Cache reference data (very long TTL)
const experts = await cachedQuery('experts-list', fetchExperts, 24 * 60 * 60 * 1000);
```

### 3. Batch Operations
```typescript
// ❌ Bad - Multiple individual inserts
for (const item of items) {
  await supabase.from('table').insert(item);
}

// ✅ Good - Single batch insert
await supabase.from('table').insert(items);
```

## 🏗️ Table Consolidation Plan

### Phase 1: Command Tables
- Merge: `command_history`, `command_tracking`, `command_usage`
- Into: `command_analytics` with type field
- Savings: 2 tables, reduced joins

### Phase 2: Work Tracking
- Merge: `work_summaries`, `ai_work_summaries`, `dev_task_work_sessions`
- Into: `work_tracking` with category field
- Savings: 2 tables, unified tracking

### Phase 3: Media Processing
- Merge: `media_transcriptions`, `media_summaries`, `media_sessions`
- Into: `media_processing` with status field
- Savings: 2 tables, cleaner schema

## 📊 Monitoring Dashboard

Check your usage at: [Supabase Dashboard](https://app.supabase.com/project/jdksnfkupzywjdfefkyj/settings/billing/usage)

Key metrics to watch:
- **Egress Bandwidth**: Must stay below 5GB
- **Database Size**: Currently within limits
- **API Requests**: Monitor for spikes

## 🚨 Warning Signs

Watch for these indicators that you're approaching limits:
1. Egress bandwidth > 4GB (80% of limit)
2. Frequent timeout errors
3. Slow query performance
4. Large result sets (>1000 records)

## 💰 Cost-Benefit Analysis

- **Current**: Free plan ($0/month)
- **Without optimization**: Pro plan ($25/month)
- **Time to implement**: 4-6 hours
- **Monthly savings**: $25
- **Annual savings**: $300

## 🔄 Maintenance Schedule

### Daily
- Monitor cache hit rates
- Check for timeout errors

### Weekly
- Run optimization analysis
- Archive old data
- Review bandwidth usage

### Monthly
- Consolidate tables as planned
- Update this document with findings
- Adjust cache TTLs based on usage

## 📝 Implementation Checklist

- [x] Create caching service
- [x] Create optimization analysis tool
- [x] Test both tools
- [x] Document usage patterns
- [ ] Implement caching in high-traffic areas
- [ ] Disable real-time subscriptions
- [ ] Archive old dev_tasks
- [ ] Consolidate command tables
- [ ] Set up monitoring alerts

## 🆘 Troubleshooting

### High Bandwidth Usage
1. Run optimization analysis
2. Check for `SELECT *` queries
3. Look for missing pagination
4. Verify caching is working

### Cache Issues
1. Check cache statistics
2. Clear stale entries
3. Adjust TTL values
4. Monitor memory usage

## 📚 Related Documentation

- [Supabase Fair Use Policy](https://supabase.com/docs/guides/platform/fair-use-policy)
- [Query Optimization Guide](https://supabase.com/docs/guides/database/query-optimization)
- Original task: #78589e74-8ba7-42aa-9927-7778fb9834f4

## 🎯 Success Criteria

You'll know the optimization is working when:
- ✅ Egress bandwidth stays below 5GB/month
- ✅ No timeout errors from Supabase
- ✅ Cache hit rate > 60%
- ✅ Query response times < 100ms
- ✅ No need to upgrade to Pro plan

---

**Next Review Date**: July 1, 2025 (one week before Fair Use Policy enforcement)