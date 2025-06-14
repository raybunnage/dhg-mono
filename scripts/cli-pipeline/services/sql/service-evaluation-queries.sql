-- Service Evaluation Queries
-- Run these to understand your current service landscape

-- 1. Overview: How many services need classification?
SELECT 
  'Total Services' as metric,
  COUNT(*) as count
FROM sys_shared_services
UNION ALL
SELECT 
  'Classified Services',
  COUNT(*) FILTER (WHERE service_type IS NOT NULL)
FROM sys_shared_services
UNION ALL
SELECT 
  'Unclassified Services',
  COUNT(*) FILTER (WHERE service_type IS NULL)
FROM sys_shared_services
UNION ALL
SELECT 
  'High Usage (10+)',
  COUNT(*) FILTER (WHERE usage_count >= 10)
FROM sys_shared_services
UNION ALL
SELECT 
  'Low Usage (1-9)',
  COUNT(*) FILTER (WHERE usage_count BETWEEN 1 AND 9)
FROM sys_shared_services
UNION ALL
SELECT 
  'Unused (0)',
  COUNT(*) FILTER (WHERE usage_count = 0 OR usage_count IS NULL)
FROM sys_shared_services;

-- 2. Top 10 Most Used Services (These should be classified first)
SELECT 
  service_name,
  usage_count,
  COALESCE(service_type, '❓ NEEDS CLASSIFICATION') as service_type,
  COALESCE(instantiation_pattern, '❓ NEEDS CLASSIFICATION') as pattern,
  CASE 
    WHEN has_browser_variant THEN '✅ Browser Support'
    ELSE '❌ No Browser Support'
  END as browser_support
FROM sys_shared_services
ORDER BY usage_count DESC NULLS LAST
LIMIT 10;

-- 3. Find Potential Duplicates by Name Similarity
WITH service_pairs AS (
  SELECT 
    s1.service_name as service1,
    s2.service_name as service2,
    s1.usage_count as usage1,
    s2.usage_count as usage2
  FROM sys_shared_services s1
  CROSS JOIN sys_shared_services s2
  WHERE s1.service_name < s2.service_name
    AND (
      -- Similar names
      s1.service_name ILIKE '%' || 
        regexp_replace(s2.service_name, '(Service|Manager|Handler|Provider)$', '') || '%'
      OR s2.service_name ILIKE '%' || 
        regexp_replace(s1.service_name, '(Service|Manager|Handler|Provider)$', '') || '%'
    )
)
SELECT 
  service1,
  usage1,
  service2,
  usage2,
  '🔄 Potential Duplicate' as status
FROM service_pairs
ORDER BY usage1 + usage2 DESC;

-- 4. Services by Category (Find overlapping functionality)
SELECT 
  COALESCE(category, 'Uncategorized') as category,
  COUNT(*) as service_count,
  STRING_AGG(service_name, ', ' ORDER BY usage_count DESC) as services,
  SUM(usage_count) as total_usage
FROM sys_shared_services
GROUP BY category
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 5. Infrastructure Services Audit (Should be singletons)
SELECT 
  service_name,
  service_type,
  instantiation_pattern,
  CASE 
    WHEN service_type = 'infrastructure' AND instantiation_pattern != 'singleton' 
    THEN '⚠️ Should be singleton!'
    WHEN service_type = 'infrastructure' AND instantiation_pattern = 'singleton'
    THEN '✅ Correct pattern'
    ELSE '❓ Needs classification'
  END as pattern_check,
  resource_management
FROM sys_shared_services
WHERE service_type = 'infrastructure'
   OR service_name ILIKE ANY(ARRAY['%client%', '%connection%', '%logger%', '%auth%'])
ORDER BY pattern_check;

-- 6. Business Services Audit (Should use DI)
SELECT 
  service_name,
  service_type,
  instantiation_pattern,
  CASE 
    WHEN service_type = 'business' AND instantiation_pattern = 'singleton' 
    THEN '⚠️ Should use dependency injection!'
    WHEN service_type = 'business' AND instantiation_pattern = 'dependency_injection'
    THEN '✅ Correct pattern'
    ELSE '❓ Needs classification'
  END as pattern_check
FROM sys_shared_services
WHERE service_type = 'business'
   OR service_name ILIKE ANY(ARRAY['%processor%', '%handler%', '%manager%', '%service%'])
ORDER BY pattern_check;

-- 7. Environment Support Analysis
SELECT 
  CASE 
    WHEN environment_support @> ARRAY['both']::TEXT[] THEN 'Universal (both)'
    WHEN environment_support @> ARRAY['browser']::TEXT[] THEN 'Browser Only'
    WHEN environment_support @> ARRAY['node']::TEXT[] THEN 'Node.js Only'
    ELSE 'Not Specified'
  END as environment,
  COUNT(*) as service_count,
  STRING_AGG(service_name, ', ' ORDER BY usage_count DESC) as services
FROM sys_shared_services
GROUP BY environment_support
ORDER BY service_count DESC;

-- 8. Unused Services (Candidates for removal)
SELECT 
  service_name,
  service_path,
  last_usage_scan,
  COALESCE(usage_count, 0) as usage_count,
  'Consider removing' as recommendation
FROM sys_shared_services
WHERE (usage_count = 0 OR usage_count IS NULL)
  AND created_at < NOW() - INTERVAL '30 days'
ORDER BY created_at;

-- 9. Quick Classification Helper
-- Use this to generate UPDATE statements for classification
SELECT 
  service_name,
  CASE 
    WHEN service_name ILIKE ANY(ARRAY['%client%', '%connection%', 'logger%', '%auth%'])
    THEN 'infrastructure'
    WHEN service_name ILIKE ANY(ARRAY['%service', '%processor%', '%handler%', '%manager%'])
    THEN 'business'
    ELSE 'hybrid'
  END as suggested_type,
  CASE 
    WHEN service_path ILIKE '%singleton%' OR is_singleton = true
    THEN 'singleton'
    ELSE 'dependency_injection'
  END as suggested_pattern,
  FORMAT(
    'UPDATE sys_shared_services SET service_type = ''%s'', instantiation_pattern = ''%s'' WHERE service_name = ''%s'';',
    CASE 
      WHEN service_name ILIKE ANY(ARRAY['%client%', '%connection%', 'logger%', '%auth%'])
      THEN 'infrastructure'
      WHEN service_name ILIKE ANY(ARRAY['%service', '%processor%', '%handler%', '%manager%'])
      THEN 'business'
      ELSE 'hybrid'
    END,
    CASE 
      WHEN service_path ILIKE '%singleton%' OR is_singleton = true
      THEN 'singleton'
      ELSE 'dependency_injection'
    END,
    service_name
  ) as update_sql
FROM sys_shared_services
WHERE service_type IS NULL
ORDER BY usage_count DESC NULLS LAST
LIMIT 20;

-- 10. Service Health Summary Dashboard
SELECT 
  '🏥 Service Health Report' as report,
  NOW()::DATE as date
UNION ALL
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━',
  NULL
UNION ALL
SELECT 
  '📊 Classification: ' || 
    COUNT(*) FILTER (WHERE service_type IS NOT NULL) || '/' || 
    COUNT(*) || ' (' || 
    ROUND(100.0 * COUNT(*) FILTER (WHERE service_type IS NOT NULL) / COUNT(*), 1) || '%)',
  NULL
FROM sys_shared_services
UNION ALL
SELECT 
  '🎯 Usage Tracking: ' || 
    COUNT(*) FILTER (WHERE usage_count > 0) || ' used, ' ||
    COUNT(*) FILTER (WHERE usage_count = 0 OR usage_count IS NULL) || ' unused',
  NULL
FROM sys_shared_services
UNION ALL
SELECT 
  '🧪 Test Coverage: ' || 
    COUNT(*) FILTER (WHERE test_coverage_percent >= 80) || ' well-tested, ' ||
    COUNT(*) FILTER (WHERE test_coverage_percent < 80 OR test_coverage_percent IS NULL) || ' need testing',
  NULL
FROM sys_shared_services
UNION ALL
SELECT 
  '🔄 Duplicates: ' || 
    COUNT(*) FILTER (WHERE overlaps_with IS NOT NULL) || ' potential duplicates found',
  NULL
FROM sys_shared_services;