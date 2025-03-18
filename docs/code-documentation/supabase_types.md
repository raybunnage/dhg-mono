# Understanding Supabase Types (types.ts)

## Overview
The `types.ts` file contains TypeScript definitions that help us work with our Supabase database in a type-safe way. Think of it as a map that tells our code what data looks like and how different parts of the database are connected.

## Main Components

### 1. Tables
Tables are where we store our data. Each table has three main parts:
- `Row`: What the data looks like when we read it
- `Insert`: What fields we need when adding new data
- `Update`: What fields we can change on existing data

Example:

### 2. Relationships
Relationships show how different tables are connected to each other. They're like bridges between our data.

Example:


This means:
- A source can be connected to an expert
- We use `expert_id` to make this connection
- It links to the `id` field in the `experts` table
- One expert can have many sources (`isOneToOne: false`)

### 3. Views
Views are like virtual tables. They show us data in a specific way without storing it separately.
- They're useful for combining data from multiple tables
- Or showing data in a specific format
- They work like tables but we can't directly change their data

Example:

### 4. Functions
Functions are special operations we can run in the database.
- They take inputs (`Args`)
- They return outputs (`Returns`)
- They can do complex operations with our data

Example:

This means `processing_status` can only be one of these four values.

## Using Types in Your Code

### Basic Usage
```

### Working with Relationships
When a table has relationships, you can join the data:

```typescript
// Get a source and its related expert
const { data } = await supabase
  .from('sources_google')
  .select(`
    *,
    expert:expert_id (
      name,
      email
    )
  `)
```

## Tips for Beginners
1. Think of types as guardrails that help prevent mistakes
2. Use your code editor's autocomplete - it knows what fields exist
3. When you see `| null`, it means that field is optional
4. Relationships help you connect data between tables
5. Views are read-only ways to see your data
6. Functions are like special commands you can run
7. Enums are preset options you can choose from

## Common Patterns
1. Reading data: Use the `Row` type
2. Creating data: Use the `Insert` type
3. Updating data: Use the `Update` type
4. Joining tables: Use the relationships
5. Complex queries: Use views or functions

Remember: The types file is automatically generated from your database schema. If you change your database structure, you'll need to regenerate this file.