-- Media content view with expert information
-- This view joins google_sources with presentations, expert_documents, experts and subject classifications
-- to provide a comprehensive view of media content for both video and audio applications

CREATE OR REPLACE VIEW media_content_view AS
SELECT
  sg.id AS source_id,
  sg.name AS media_name,
  sg.mime_type,
  sg.web_view_link,
  sg.path,
  p.id AS presentation_id,
  p.title AS presentation_title,
  ed.id AS expert_document_id,
  ed.title AS transcript_title,
  CASE 
    WHEN sg.mime_type LIKE 'audio/%' THEN 'audio'
    WHEN sg.mime_type LIKE 'video/%' THEN 'video'
    ELSE 'other'
  END AS media_type,
  sge.expert_id,
  e.expert_name,
  e.full_name AS expert_full_name,
  sc.subject,
  tc.entity_id
FROM
  google_sources sg
LEFT JOIN
  presentations p ON sg.id = p.video_source_id
LEFT JOIN
  expert_documents ed ON sg.id = ed.source_id
LEFT JOIN
  google_sources_experts sge ON sg.id = sge.source_id
LEFT JOIN
  experts e ON sge.expert_id = e.id
LEFT JOIN
  table_classifications tc ON tc.entity_id = sg.id AND tc.entity_type = 'google_sources'
LEFT JOIN
  subject_classifications sc ON sc.id = tc.subject_classification_id
WHERE
  sg.mime_type IN ('audio/x-m4a', 'audio/mpeg', 'video/mp4', 'application/vnd.google-apps.video')
  AND sg.is_deleted = false;