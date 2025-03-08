# SQL Query Generation Guide

## Information Needed From Users

### Database Structure
Please provide the following details about your database:

1. **Table information**:
   - Complete list of all tables in your database
   - Primary keys for each table
   - Foreign key relationships between tables

2. **For each table**:
   - Field/column names
   - Data types for each field
   - Any constraints (NOT NULL, UNIQUE, etc.)
   - Default values (if any)
   - Indexes (if any)

3. **Database system**:
   - Which database system are you using? (MySQL, PostgreSQL, SQL Server, Oracle, SQLite, etc.)
   - Version of the database system

### Query Requirements

1. **Query objective**:
   - What information are you trying to retrieve or what action are you trying to perform?
   - Is this a SELECT, INSERT, UPDATE, DELETE, or other type of query?

2. **Specific requirements**:
   - Which tables need to be involved?
   - What conditions should be applied?
   - What fields should be returned (for SELECT queries)?
   - How should results be sorted or grouped?
   - Any limits on the number of results?

3. **Performance considerations**:
   - Expected data volume
   - Query execution frequency
   - Any performance requirements or constraints

### Example

Here's an example of the information that would be helpful:

```
Database: PostgreSQL 14

Tables:
1. customers
   - customer_id (INT, PK)
   - name (VARCHAR(100), NOT NULL)
   - email (VARCHAR(100), UNIQUE)
   - created_at (TIMESTAMP)

2. orders
   - order_id (INT, PK)
   - customer_id (INT, FK -> customers.customer_id)
   - order_date (DATE, NOT NULL)
   - total_amount (DECIMAL(10,2))
   - status (VARCHAR(20))

Query objective: 
Need to find all customers who placed orders totaling more than $1000 in January 2023, sorted by the total amount spent in descending order.
```

## SQL Query Template Examples

### SELECT Query Template
```sql
SELECT 
    [columns]
FROM 
    [table1]
[JOIN type] JOIN 
    [table2] ON [join_condition]
WHERE 
    [conditions]
GROUP BY 
    [columns]
HAVING 
    [group_conditions]
ORDER BY 
    [columns] [ASC|DESC]
LIMIT 
    [limit_number]
OFFSET 
    [offset_number];
```

### INSERT Query Template
```sql
INSERT INTO 
    [table] ([column1], [column2], ...)
VALUES
    ([value1], [value2], ...),
    ([value1], [value2], ...);
```

### UPDATE Query Template
```sql
UPDATE 
    [table]
SET 
    [column1] = [value1],
    [column2] = [value2]
WHERE 
    [conditions];
```

### DELETE Query Template
```sql
DELETE FROM 
    [table]
WHERE 
    [conditions];
```

### Common Table Expression (CTE) Template
```sql
WITH cte_name AS (
    SELECT 
        [columns]
    FROM 
        [table]
    WHERE 
        [conditions]
)
SELECT 
    [columns]
FROM 
    cte_name
WHERE 
    [conditions];
```

## Database-Specific Syntax Considerations

### MySQL
- Uses backticks (`) for identifiers
- LIMIT clause comes after ORDER BY
- Date functions like DATE_FORMAT()

### PostgreSQL
- Uses double quotes (") for identifiers
- Supports LIMIT and OFFSET
- Rich set of JSON functions

### SQL Server
- Uses square brackets ([]) for identifiers
- TOP clause instead of LIMIT
- DATEPART() for date manipulation

### Oracle
- Uses double quotes (") for identifiers
- ROWNUM or ROW_NUMBER() instead of LIMIT
- TO_DATE() function for date conversion

## Additional Context
If you have any specific business rules, edge cases, or other contextual information that might affect the query, please include that as well.