# Database Field Statistics

This table presents statistics for each field in the database, showing total count, null count, and null percentage.

| Field Name | Total Count | Null Count | Null Percentage (%) | 
|------------|-------------|------------|---------------------|
| Total Rows | 839 | 0 | 0.0 |
| expert_id | 839 | 839 | 100.00 |
| last_indexed | 839 | 838 | 99.88 |
| document_type_id | 839 | 704 | 83.91 |
| thumbnail_link | 839 | 280 | 33.37 |
| main_video_id | 839 | 200 | 23.84 |
| size | 839 | 181 | 21.57 |
| is_root | 839 | 2 | 0.24 |
| parent_folder_id | 839 | 1 | 0.12 |
| path_depth | 839 | 0 | 0.00 |
| is_deleted | 839 | 0 | 0.00 |
| metadata | 839 | 0 | 0.00 |
| modified_at | 839 | 0 | 0.00 |
| web_view_link | 839 | 0 | 0.00 |
| root_drive_id | 839 | 0 | 0.00 |
| drive_id | 839 | 0 | 0.00 |
| mime_type | 839 | 0 | 0.00 |
| created_at | 839 | 0 | 0.00 |
| updated_at | 839 | 0 | 0.00 |
| name | 839 | 0 | 0.00 |
| id | 839 | 0 | 0.00 |
| path | 839 | 0 | 0.00 |
| path_array | 839 | 0 | 0.00 |

## Analysis

- **Completely Empty Fields**: The `expert_id` field is 100% null, and `last_indexed` is nearly completely empty (99.88%).
- **Mostly Empty Fields**: `document_type_id` has a high null percentage (83.91%).
- **Partially Empty Fields**: `thumbnail_link` (33.37%), `main_video_id` (23.84%), and `size` (21.57%) have moderate amounts of null values.
- **Complete Fields**: Most fields have no null values, indicating good data completeness for the majority of the database structure.
