

CREATE TABLE "subject_classifications" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject TEXT NOT NULL,
    subject_character TEXT,
    short_name TEXT,
    associated_concepts TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


   subject_classifications: {
        Row: {
          associated_concepts: string | null
          created_at: string | null
          id: string
          short_name: string | null
          subject: string
          subject_character: string | null
          updated_at: string | null
        }

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subject_classifications_updated_at
    BEFORE UPDATE ON subject_classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE "presentations" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    high_level_folder_source_id UUID REFERENCES sources_google(id),  -- Assuming this references a sources_google table
    video_source_id UUID REFERENCES sources_google(id),              -- Assuming this references a sources_google table
    web_view_link TEXT,
    root_drive_id TEXT,
    expert_document_id UUID REFERENCES expert_documents(id),
    expert_id UUID REFERENCES experts(id),
    view_count INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Add indexes for frequently queried fields and foreign keys
    CONSTRAINT view_count_non_negative CHECK (view_count >= 0),
    CONSTRAINT duration_seconds_non_negative CHECK (duration_seconds >= 0)
);

     presentations: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          expert_document_id: string | null
          expert_id: string | null
          high_level_folder_source_id: string | null
          id: string
          root_drive_id: string | null
          title: string | null
          updated_at: string | null
          video_source_id: string | null
          view_count: number | null
          web_view_link: string | null
        }

-- Create index for performance on common queries
CREATE INDEX idx_presentations_expert_id ON presentations(expert_id);
CREATE INDEX idx_presentations_expert_document_id ON presentations(expert_document_id);
CREATE INDEX idx_presentations_video_source_id ON presentations(video_source_id);

-- Create trigger for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presentations_updated_at
    BEFORE UPDATE ON presentations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to increment view count
CREATE OR REPLACE FUNCTION increment_presentation_view_count(presentation_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE presentations 
    SET view_count = view_count + 1 
    WHERE id = presentation_uuid;
END;
$$ LANGUAGE plpgsql;


-- Create the presentation_assets table
CREATE TABLE "presentation_assets" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    asset_source_id UUID REFERENCES sources_google(id),
    asset_expert_document_id UUID REFERENCES expert_documents(id),
    asset_role asset_role_enum,
    asset_type asset_type_enum,
    importance_level INTEGER CHECK (importance_level >= 0 AND importance_level <= 10),
    metadata JSONB,
    timestamp_start INTEGER CHECK (timestamp_start >= 0),
    timestamp_end INTEGER CHECK (timestamp_end >= 0),
    user_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Add constraint to ensure timestamp_end is after timestamp_start
    CONSTRAINT valid_timestamp_range 
        CHECK (timestamp_end IS NULL OR timestamp_start IS NULL OR timestamp_end >= timestamp_start)
);

    presentation_assets: {
        Row: {
          asset_expert_document_id: string | null
          asset_role: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id: string | null
          asset_type: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at: string | null
          id: string
          importance_level: number | null
          metadata: Json | null
          presentation_id: string
          timestamp_end: number | null
          timestamp_start: number | null
          updated_at: string | null
          user_notes: string | null
        }

-- Create indexes for better query performance
CREATE INDEX idx_presentation_assets_presentation_id ON presentation_assets(presentation_id);
CREATE INDEX idx_presentation_assets_asset_source_id ON presentation_assets(asset_source_id);
CREATE INDEX idx_presentation_assets_asset_expert_document_id ON presentation_assets(asset_expert_document_id);
CREATE INDEX idx_presentation_assets_asset_type ON presentation_assets(asset_type);
CREATE INDEX idx_presentation_assets_metadata ON presentation_assets USING gin (metadata);

-- Create trigger for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presentation_assets_updated_at
    BEFORE UPDATE ON presentation_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();






  CREATE TYPE classified_entity_type AS ENUM (
    'expert_documents',
    'documentation_files',
    'sources_google',
    'scripts'
  );


  -- Create the table_classifications junction table
  CREATE TABLE table_classifications (
    id uuid default gen_random_uuid() primary key NOT NULL,
    entity_type classified_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    subject_classification_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    notes text,

    -- Add foreign key constraint to subject_classifications table
    CONSTRAINT fk_subject_classification
      FOREIGN KEY (subject_classification_id)
      REFERENCES subject_classifications(id)
      ON DELETE CASCADE,

    -- Add unique constraint to prevent duplicate classifications
    CONSTRAINT unique_entity_classification
      UNIQUE (entity_type, entity_id, subject_classification_id)
  );

  -- Create indexes for better query performance
  CREATE INDEX idx_table_classifications_entity_id ON table_classifications(entity_id);
  CREATE INDEX idx_table_classifications_subject_classification_id ON
  table_classifications(subject_classification_id);
  CREATE INDEX idx_table_classifications_entity_type ON table_classifications(entity_type);

  -- Create a composite index for common query patterns
  CREATE INDEX idx_table_classifications_compound ON table_classifications(entity_type, entity_id,
  subject_classification_id);

  -- Add comment to explain the table's purpose
  COMMENT ON TABLE table_classifications IS 'Junction table allowing many-to-many relationships 
  between various entities and subject classifications';
  
-- Create a view that joins table_classifications to expert_documents and related tables
CREATE OR REPLACE VIEW document_classifications_view AS
SELECT 
  sg.name AS file_name,
  ed.processed_content,
  dt.document_type,
  sc.short_name AS subject_classification
FROM 
  table_classifications tc
JOIN 
  expert_documents ed ON tc.entity_id = ed.id AND tc.entity_type = 'expert_document'
JOIN 
  document_types dt ON ed.document_type_id = dt.id
JOIN 
  subject_classifications sc ON tc.subject_classification_id = sc.id
LEFT JOIN 
  sources_google sg ON ed.source_id = sg.id
ORDER BY 
  sg.filename;


the entity_id in table_classifications is id of the  expert_documents table 
give me sql that returns all the expert_documents that do not have at least one id entry in the table_classifications table and join to the sources_google on the source_id field of expert_documents and make sure you exclude the following mime_types, document_types and all folders

-- unsupported folders
bd903d99-64a1-4297-ba76-1094ab235dac 
dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd 
0d61a685-10e0-4c82-b964-60b88b02ac15 



=== Unsupported Document Type IDs ===
6ece37e7-840d-4a0c-864d-9f1f971b1d7e | m4a audio
e9d3e473-5315-4837-9f5f-61f150cbd137 | Code Documentation Markdown
4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af | mp3 audio
d2206940-e4f3-476e-9245-0e1eb12fd195 | aac audio
8ce8fbbc-b397-4061-a80f-81402515503b | m3u file
fe697fc5-933c-41c9-9b11-85e0defa86ed | wav audio
db6518ad-765c-4a02-a684-9c2e49d77cf5 | png image
68b95822-2746-4ce1-ad35-34e5b0297177 | jpg image
3e7c880c-d821-4d01-8cc5-3547bdd2e347 | video mpeg
d70a258e-262b-4bb3-95e3-f826ee9b918b | video quicktime
91fa92a3-d606-493b-832d-9ba1fa83dc9f | video microsoft avi
28ab55b9-b408-486f-b1c3-8f0f0a174ad4 | m4v
2c1d3bdc-b429-4194-bec2-7e4bbb165dbf | conf file
53f42e7d-78bd-4bde-8106-dc12a4835695 | Document Processing Script
4fdbd8be-fe5a-4341-934d-2b6bd43be7be | CI CD Pipeline Script
a1dddf8e-1264-4ec0-a5af-52eafb536ee3 | Deployment Script
561a86b0-7064-4c20-a40e-2ec6905c4a42 | Database Management Script
f7e83857-8bb8-4b18-9d8f-16d5cb783650 | Environment Setup Script
b26a68ed-a0d1-415d-8271-cba875bfe3ce | xlsx document
920893fc-f0be-4211-85b4-fc29882ade97 | google sheet
e29b5194-7ba0-4a3c-a7db-92b0d8adca6a | Unknown Type
9dbe32ff-5e82-4586-be63-1445e5bcc548 | unknown document type

=== Unsupported MIME Types ===
application/vnd.google-apps.audio
application/vnd.google-apps.video
application/vnd.google-apps.drawing
application/vnd.google-apps.form
application/vnd.google-apps.map
application/vnd.google-apps.presentation
audio/mpeg
audio/mp3
audio/wav
audio/ogg
video/mpeg
video/quicktime
video/x-msvideo
image/jpeg
image/png
image/gif
image/svg+xml


please remove the following 3 commands in the classify cli pipeline as they didnt work well and we have a better way now

classify-cli write-unclassified-ids 
  $ classify-cli classify-batch-from-file 
  $ classify-cli check-classified-files 
  




  Here are all the objects involved.

  I need you to fill in the presentations table records.
  first go through each sources_google file that is an mp4 file and create a presentation record for it.

  From the sources_google file you can get the id field, and the video_source_id is the id of the mp4 file from sources_google. Also the web_view_link is the web view link of the mp4 file from sources_google, as well as the root_drive_id. If possible provide the duration_seconds field from the size field of the sources_google file.

  Then find the related expert_documents record and you can pull the title from the dedicted field and transfer it to the presentations title field.

  after you have created the presentation record with these basic fields for each mp4 file, 
  use this query   
"select id, path_depth, main_video_id, name from sources_google where path_depth = 0 and document_type_id = 'bd903d99-64a1-4297-ba76-1094ab235dac'"

when the main_video_id in this query matches the id of the sources_google mp4 you know you have the right high_level_folder_source_id  and you can set that wih this field in presentations table with this source_id field.   Now you can use this folder id as it is the source_id in the sources_google_experts table and you can return the associated expert_id field and set it in the presetnations.  Thus you should be able to get all the fields for the presentations table except the view count which we'll  work out later. 




now the presentations_assets table you need to do the following
for each presentation that has a high_level_folder_source_id with a depth of zero
find that source id in the sources_google table and that folder which is have a path_depth of 0 and then do a recursive search within each of those folders to find all the files that are in it (you can go to a depth of 6 levels) - if it is a supported file then create a presentation_assets record for it and fill in the the presentation_id of the presentation record you created earlier that has the video and fill in the following fields:

asset_source_id is the source_id of the file in the sources_google table
asset_expert_document_id is the expert_document_id of the file in the expert_documents table
skip asset_role and asset_type and and importance_level, timestamp_start and timestamp_end at the moment 
metadata may be used later but leave it alone for now


files you need to skip are the unsupported types where are listed here:
=== Unsupported Document Type IDs ===
6ece37e7-840d-4a0c-864d-9f1f971b1d7e | m4a audio
e9d3e473-5315-4837-9f5f-61f150cbd137 | Code Documentation Markdown
4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af | mp3 audio
d2206940-e4f3-476e-9245-0e1eb12fd195 | aac audio
8ce8fbbc-b397-4061-a80f-81402515503b | m3u file
fe697fc5-933c-41c9-9b11-85e0defa86ed | wav audio
db6518ad-765c-4a02-a684-9c2e49d77cf5 | png image
68b95822-2746-4ce1-ad35-34e5b0297177 | jpg image
3e7c880c-d821-4d01-8cc5-3547bdd2e347 | video mpeg
d70a258e-262b-4bb3-95e3-f826ee9b918b | video quicktime
91fa92a3-d606-493b-832d-9ba1fa83dc9f | video microsoft avi
28ab55b9-b408-486f-b1c3-8f0f0a174ad4 | m4v
2c1d3bdc-b429-4194-bec2-7e4bbb165dbf | conf file
53f42e7d-78bd-4bde-8106-dc12a4835695 | Document Processing Script
4fdbd8be-fe5a-4341-934d-2b6bd43be7be | CI CD Pipeline Script
a1dddf8e-1264-4ec0-a5af-52eafb536ee3 | Deployment Script
561a86b0-7064-4c20-a40e-2ec6905c4a42 | Database Management Script
f7e83857-8bb8-4b18-9d8f-16d5cb783650 | Environment Setup Script
b26a68ed-a0d1-415d-8271-cba875bfe3ce | xlsx document
920893fc-f0be-4211-85b4-fc29882ade97 | google sheet
e29b5194-7ba0-4a3c-a7db-92b0d8adca6a | Unknown Type
9dbe32ff-5e82-4586-be63-1445e5bcc548 | unknown document type

=== Unsupported MIME Types ===
application/vnd.google-apps.audio
application/vnd.google-apps.video
application/vnd.google-apps.drawing
application/vnd.google-apps.form
application/vnd.google-apps.map
application/vnd.google-apps.presentation
audio/mpeg
audio/mp3
audio/wav
audio/ogg
video/mpeg
video/quicktime
video/x-msvideo
image/jpeg
image/png
image/gif
image/svg+xml




-- Create the presentation_assets table
CREATE TABLE "presentation_assets" (
    presentation_id  -- comes from the presentations table
    asset_source_id UUID REFERENCES sources_google(id),
    asset_expert_document_id UUID REFERENCES expert_documents(id),
    asset_role asset_role_enum,
    asset_type asset_type_enum,
    importance_level INTEGER CHECK (importance_level >= 0 AND importance_level <= 10),
    metadata JSONB,
    timestamp_start INTEGER CHECK (timestamp_start >= 0),
    timestamp_end INTEGER CHECK (timestamp_end >= 0),
    user_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Add constraint to ensure timestamp_end is after timestamp_start
    CONSTRAINT valid_timestamp_range 
        CHECK (timestamp_end IS NULL OR timestamp_start IS NULL OR timestamp_end >= timestamp_start)
);


 







[
  {
    "file_name": "~$DG.Topics.23.24.docx"
  },
  {
    "file_name": "~$eldon Solomon.docx"
  },
  {
    "file_name": "03.08.24.Landenecker.mp4"
  },
  {
    "file_name": "10.14.20.Aria.Patterson.Carter.Social Connection.mp4"
  },
  {
    "file_name": "10.28.24.Polyvagal Steering.Topics..docx"
  },
  {
    "file_name": "10.4.23.Hanscom:Clawson.mp4"
  },
  {
    "file_name": "10.6.21.Katja.Porges.docx"
  },
  {
    "file_name": "11.2.22.Staats.mp4"
  },
  {
    "file_name": "11.25.24.DHDG.Potential Speakers.Full.11.23.24.docx"
  },
  {
    "file_name": "1.18.23.Bezruchka.Population Health.mp4"
  },
  {
    "file_name": "1.Gevirtz.txt"
  },
  {
    "file_name": "2020-07-01-Neuroimaging and Chronic Pain Circuits - Apkarian discussion"
  },
  {
    "file_name": "2020-07-01-Refs-comments-Apkarian-Neuroimaging- Pain Circuits - Apkarian discussion.pdf"
  },
  {
    "file_name": "2020-07-07-Emotional Awareness and Expression Therapy Discussion.pdf"
  },
  {
    "file_name": "2020_Wager_Slide deck.pdf"
  },
  {
    "file_name": "20211101_Chronic Pain Prevention-A Rheum with a View_SteveOverman.pptx"
  },
  {
    "file_name": "2023-10-04-Hanscom/Clawson-RUTs neuroscience"
  },
  {
    "file_name": "2024-11-06-Sutphin.docx"
  },
  {
    "file_name": "2025 HRV International Conference Program.pdf"
  },
  {
    "file_name": "2201 Biosketch no photo.docx"
  },
  {
    "file_name": "3.15.23.Tamara Turner.Dance.Trance.mp4"
  },
  {
    "file_name": "3.29.23.Miller.Mast Cells.mp4"
  },
  {
    "file_name": "3 Laws.pptx"
  },
  {
    "file_name": "4.Plan A.docx"
  },
  {
    "file_name": "5.20.20.Flight to Freeze.mp4"
  },
  {
    "file_name": "5.8.24Kjearvik.mp4"
  },
  {
    "file_name": "6.10.10.Anger.Sympathetic.mp4"
  },
  {
    "file_name": "6.16.21.DR Clawson.The very bottom up.mp4"
  },
  {
    "file_name": "6.3.20.Vagal Stim.mp4"
  },
  {
    "file_name": "7.22.20.ANS.Safetyvs.Threat.mp4"
  },
  {
    "file_name": "8.18.21.Mel Pohl.mp4"
  },
  {
    "file_name": "9.7.22.Aria.Porges.SSP.mp4"
  },
  {
    "file_name": "9 FINAL The Role of Forgiveness in Chronic Pain and Fibromyalgia.pdf"
  },
  {
    "file_name": "Abernathy.2.16.22.PVT and Medicine.mp4"
  },
  {
    "file_name": "Abstract-Grinevch.docx"
  },
  {
    "file_name": "Adam Goldstein blog.docx"
  },
  {
    "file_name": "AH Inflammation and depression but where does the inflammation come from.pdf"
  },
  {
    "file_name": "AH-Inﬂammation-Associated Co-morbidity Between Depression and Cardiovascular Disease.pdf"
  },
  {
    "file_name": "AH Modulation of the inflammatory response benefits treatment-resistant bipolar depression.pdf"
  },
  {
    "file_name": "AH-Neuroinflammation and neurotoxicity contribute to neuroprogression.pdf"
  },
  {
    "file_name": "AH-NEUROLOGICAL DISORDERS DEPRESSION AND INFLAMMATION.pdf"
  },
  {
    "file_name": "AH Pro-inflammatory biomarkers in depression-venlafaxine.pdf"
  },
  {
    "file_name": "AH Psychocardiology moving toward a new subspecialty-pdf.pdf"
  },
  {
    "file_name": "AI analysis of Clauw sensitivity paper.docx"
  },
  {
    "file_name": "AI.Lane.Biased compteition.Summary.docx"
  },
  {
    "file_name": "AI_Teicher_ACES_brain_Stucture.docx"
  },
  {
    "file_name": "Akparian.Q&A.7.1.20.mp4"
  },
  {
    "file_name": "Alia Crum.docx"
  },
  {
    "file_name": "Alison Escalante.docx"
  },
  {
    "file_name": "Alison Escalante TED Talk.docx"
  },
  {
    "file_name": "Allan Abbass presentation Apr 6 2022.mp4"
  },
  {
    "file_name": "Alzheimer.Speakers.docx"
  },
  {
    "file_name": "Amster.Eagle.2.10.21.mp4"
  },
  {
    "file_name": "Anderson.Osteoporosis.inflammation.5.18.22.mp4"
  },
  {
    "file_name": "Andra DeVoght.docx"
  },
  {
    "file_name": "Andrew Steele.docx"
  },
  {
    "file_name": "Angelos Halaris Announcement.docx"
  },
  {
    "file_name": "Anger.Clawson.Announcement.8.29.24.docx"
  },
  {
    "file_name": "Anger.nociplastic pain. Clauw.steering group.11.14.24.docx"
  },
  {
    "file_name": "Anger.pptx"
  },
  {
    "file_name": "Apkarian&Baliki.pdf"
  },
  {
    "file_name": "ApkarianSlideDeck.pptx"
  },
  {
    "file_name": "Appeasement replacing Stockholm syndrome as a definition of a survival strategy.pdf"
  },
  {
    "file_name": "A_Psycho_Educational_Video_Used_in_the_E.pdf"
  },
  {
    "file_name": "Aria.Porges.SSP.mp4"
  },
  {
    "file_name": "Aria.Porges.SSP.txt"
  },
  {
    "file_name": "Artikel. SEartikel2020 (1).pdf"
  },
  {
    "file_name": "Artikel. SE. Maj 2017. A-randomized-controlled-trial-of-brief-Somatic-Experiencing-for-chronic-low-back-pain-and-comorbid-post-traumatic-stress-disorder-symptoms.pdf"
  },
  {
    "file_name": "Artikel SE. Proticol 2018. Somatic_experiencing_for_patients.pdf"
  },
  {
    "file_name": "Ashar.Pain Reprocessing Therapy vs Placebo and Usual Care- Ashar Schubiner Wager- JAMA Psychiatry 2021.pdf"
  },
  {
    "file_name": "Austin Perlutter.docx"
  },
  {
    "file_name": "AutonomicRehabilitation.pdf"
  },
  {
    "file_name": "Belanoff.Preterm births.neighborhood.JAMA.2024.pdf"
  },
  {
    "file_name": "Benjamin Buemann.oxy.aging.docx"
  },
  {
    "file_name": "Benzon, Practical Management of Pain 6e, chapter 12.pdf"
  },
  {
    "file_name": "Bernie Seigel Announcement.docx"
  },
  {
    "file_name": "Bernie Seigel Discussion Group presentation.docx"
  },
  {
    "file_name": "Bernie Seigel.mp4"
  },
  {
    "file_name": "BezruchkaDynamicHealting230118Sent.pptx"
  },
  {
    "file_name": "Bharathi Pandi Intro.docx"
  },
  {
    "file_name": "Biased Competition.......pdf"
  },
  {
    "file_name": "Bob Naviaux Announcement 2.docx"
  },
  {
    "file_name": "Boston Globe op-ed.docx"
  },
  {
    "file_name": "BowlbyPublished.pdf"
  },
  {
    "file_name": "Brain Imaging.PVT.Pain.Cytokines.docx"
  },
  {
    "file_name": "Brenda Stockdale announcement.docx"
  },
  {
    "file_name": "Bruce Perry.docx"
  },
  {
    "file_name": "Buemann.OT.AD.Sexual.2023.pdf"
  },
  {
    "file_name": "Burnstock Big Review 2017.pdf"
  },
  {
    "file_name": "Carter Announcemt.9.21.22.docx"
  },
  {
    "file_name": "Carter.COVID.OT.2020-03-EPUB.pdf"
  },
  {
    "file_name": "Carter.Horn.talk overview.docx"
  },
  {
    "file_name": "Carter.Nature's Med.Oxy Review.2020.pdf"
  },
  {
    "file_name": "Carter Notes.Cole.5.17.23.23 talk on eudaemonics.docx"
  },
  {
    "file_name": "Carter.Sex.Love.Oxytocin.2022.docx"
  },
  {
    "file_name": "Carter.Sociostasis.2023.docx"
  },
  {
    "file_name": "Carter.Stress.SexDiff.May 2021.#2.pdf"
  },
  {
    "file_name": "CFT summary 2009 Gilbert.pdf"
  },
  {
    "file_name": "chat (1).txt"
  },
  {
    "file_name": "Chat Notes.11.4.20.txt"
  },
  {
    "file_name": "chat.txt"
  },
  {
    "file_name": "Children and Pain for Polyvagal Group.pptx"
  },
  {
    "file_name": "Christopher D Gardner.docx"
  },
  {
    "file_name": "Chronic Disease Discussion Group -AH August 4, 2021.pptx"
  },
  {
    "file_name": "Chronic Disease Discussion Group.Topics.2021.docx"
  },
  {
    "file_name": "Circadian Rhythm for Healthy Lifespan.docx"
  },
  {
    "file_name": "Clauw announcement.docx"
  },
  {
    "file_name": "Clauw.fibrositis_to_fibromyalgia_to_nociplastic_pai.pdf"
  },
  {
    "file_name": "Clawson.Anger.mp4"
  },
  {
    "file_name": "Clawson Announcment.docx"
  },
  {
    "file_name": "Clawson.cytokine10.28.20.mp4"
  },
  {
    "file_name": "Clawson.Cytokine.Primer.10.28.20.txt"
  },
  {
    "file_name": "Clawson.Cytokines. Pain.pptx"
  },
  {
    "file_name": "CNS.ANS.Stimulation.Wager.5.27.20.mp4"
  },
  {
    "file_name": "Cole Announcement.docx"
  },
  {
    "file_name": "Cole.CTRA.BehSci2019.pdf"
  },
  {
    "file_name": "Cook.Clawson.5.22.244.mp4"
  },
  {
    "file_name": "Cook.DR.docx"
  },
  {
    "file_name": "Core.Deep Healing.docx"
  },
  {
    "file_name": "CV-Grinevich.pdf"
  },
  {
    "file_name": "Cytokine Q&A.11.4.20.mp4"
  },
  {
    "file_name": "Dale.Moral Injury Health Care.2021.pdf"
  },
  {
    "file_name": "Dale.Moral Injury.Health Care.mp4"
  },
  {
    "file_name": "Dan Clauw.1.22.25.mp4"
  },
  {
    "file_name": "Daniel Levitan.PVT.docx"
  },
  {
    "file_name": "Dan Siegel.docx"
  },
  {
    "file_name": "Dantzer.Resilience and immunity.2018.pdf"
  },
  {
    "file_name": "David Arndt.8.5.20.mp4"
  },
  {
    "file_name": "David Sinclair.docx"
  },
  {
    "file_name": "David Tauben Narrative Bio-Emeritus.pdf"
  },
  {
    "file_name": "Debora Lee.Compassion based PTSD.docx"
  },
  {
    "file_name": "Deep Medicine.Injustice.Malkin.docx"
  },
  {
    "file_name": "DHDG.2.21.24.open Discussion.mp4"
  },
  {
    "file_name": "DHDG 2-21-24 open Discussion.txt"
  },
  {
    "file_name": "DHDG.24.25.docx"
  },
  {
    "file_name": "DHDG.CoreSchedule.2022-23.docx"
  },
  {
    "file_name": "DHDG.Cryan.Diban.docx"
  },
  {
    "file_name": "DHDG.f:up.3.19.25.docx"
  },
  {
    "file_name": "DHDG.Nicole.12.7.22.docx"
  },
  {
    "file_name": "DHDG.Topics.23.24.docx"
  },
  {
    "file_name": "DHG.12.7.22.Nicole Restauri.Music and Healing.mp4"
  },
  {
    "file_name": "Dick Gervitz Announcement.docx"
  },
  {
    "file_name": "Dick Gevirtz 3.24.21.docx"
  },
  {
    "file_name": "Dor-Ziderman_AI_Neural Mechanisms of Death Denial.docx"
  },
  {
    "file_name": "DR Cawson.9.1.21.mp4"
  },
  {
    "file_name": "DR.Cholinergic System.docx"
  },
  {
    "file_name": "Dr. Chris Palmer.Diet.Metabolism.Psych.docx"
  },
  {
    "file_name": "DR.Dantzer.IL-6.docx"
  },
  {
    "file_name": "Dr. Gervitz.12-min.video.Whiplash.docx"
  },
  {
    "file_name": "DR.Naviaux.phenotypes.docx"
  },
  {
    "file_name": "Dynamic Healing Discussion Group.docx"
  },
  {
    "file_name": "Dynamic Healing Discussion Group Presentation.docx"
  },
  {
    "file_name": "Dynamic Healing_SocialPrescribing_Hoverman_241219.pdf"
  },
  {
    "file_name": "Dynamic healing talk.pdf"
  },
  {
    "file_name": "DynamicHealingWedGrp (Sept 7th -2022).pptx"
  },
  {
    "file_name": "Eagle.Amster Q&A.docx"
  },
  {
    "file_name": "Eagle.Armster.12.16.20.mp4"
  },
  {
    "file_name": "Earlyadversityfibromyalgia 2.pdf"
  },
  {
    "file_name": "Earlylifepain2016Expneur.pdf"
  },
  {
    "file_name": "Ego Dissolution.pdf"
  },
  {
    "file_name": "EhrlichDynamicHealingProposal250103.docx"
  },
  {
    "file_name": "ellingsen duggento et al 2022 trans psych granger concordance.pdf"
  },
  {
    "file_name": "ellingsen et al 2020 SciAdv hyperscan dynamic concordance.pdf"
  },
  {
    "file_name": "ellingsen et al 2023 PNAS brain-to-brain patient-clinician empathy hyperscanning.pdf"
  },
  {
    "file_name": "Emeran Mayer.docx"
  },
  {
    "file_name": "Emotional vs physical pain.mp4"
  },
  {
    "file_name": "Envy.pdf"
  },
  {
    "file_name": "Erik Pepper announcement.docx"
  },
  {
    "file_name": "Escape from Evil Overview.docx"
  },
  {
    "file_name": "Etienne_personality.pdf"
  },
  {
    "file_name": "Evidentiary-Basis-for-ILF-Neurofeedback.pdf"
  },
  {
    "file_name": "Evolution of a Trauma Protocol Quarter Century 11 22 20 .pdf"
  },
  {
    "file_name": "Field_2020_SR.pdf"
  },
  {
    "file_name": "Field_2020_survey.pdf"
  },
  {
    "file_name": "Field_2021_animal_scope.pdf"
  },
  {
    "file_name": "Field_2021_clinicaltrial.pdf"
  },
  {
    "file_name": "Field_2021_clinicaltrial_qualitative.pdf"
  },
  {
    "file_name": "Field_2022_human_scope.pdf"
  },
  {
    "file_name": "Florence Williams.PVG.docx"
  },
  {
    "file_name": "fMRI.pain.Empathy.Medscape.2023.docx"
  },
  {
    "file_name": "FND ISTDP review 2022.pdf"
  },
  {
    "file_name": "Forgotten negative emotional memories increase pain unpleasantness.docx"
  },
  {
    "file_name": "Fradkin.Obsessive Thoughts.1.8.23.mp4"
  },
  {
    "file_name": "Fradkin.Preimpting thoujghts.PLOS.2022.pdf"
  },
  {
    "file_name": "Francis Peabody's the_care_of_the_patient_commentary  1984 JAMA.PDF"
  },
  {
    "file_name": "Fred Luskin.docx"
  },
  {
    "file_name": "From Flight to Faint.11.18.20.mp4"
  },
  {
    "file_name": "From Flight to Faint.11.18.20.txt"
  },
  {
    "file_name": "From Threat to Safety and Beyond-shared version.pptx"
  },
  {
    "file_name": "From Threat to Safety and Beyond-summary-1.pdf"
  },
  {
    "file_name": "FSADynamicHealingMarch5.2025Revised.docx"
  },
  {
    "file_name": "Fuentes.Frontiers.ACE's.visceral Pain.2018.pdf"
  },
  {
    "file_name": "Garland Announcement.docx"
  },
  {
    "file_name": "Garland.Tall Poppy.mp4"
  },
  {
    "file_name": "George Sulphin.Nematodes.aging.docx"
  },
  {
    "file_name": "Germer.Chronic Disease Discussion Group.docx"
  },
  {
    "file_name": "Germer.Shame.Self Compassion.mp4"
  },
  {
    "file_name": "Gervitz.3.24.21.mp4"
  },
  {
    "file_name": "GervitzSlides.MyofascialPain.3.1.20.pdf"
  },
  {
    "file_name": "Gevirtz.3.10.21.mp4"
  },
  {
    "file_name": "Gevirtz.3.19.25.mp4"
  },
  {
    "file_name": "Gevirtz Announcement.docx"
  },
  {
    "file_name": "Gevirtz.ANS_regualation_myofascial pain.docx"
  },
  {
    "file_name": "Gevirtz.txt"
  },
  {
    "file_name": "Gharbo.1.28.21.mp4"
  },
  {
    "file_name": "Gharbo.Placebo Questions and comments.docx"
  },
  {
    "file_name": "GigiConstable.1.6.21.mp4"
  },
  {
    "file_name": "Gigi Constable.chat.txt"
  },
  {
    "file_name": "Gilbert 2014 The origins & nature of CFT.pdf"
  },
  {
    "file_name": "Global developments in social prescribing_Morse_2022.pdf"
  },
  {
    "file_name": "Glucocorticosteroids.pptx"
  },
  {
    "file_name": "GMT20201001-000428_BIC-Q-A_640x360.mp4"
  },
  {
    "file_name": "Grinevich AI Summary.docx"
  },
  {
    "file_name": "Grosman-Rimon.MyoPainBiomarkers.Medicine..pdf"
  },
  {
    "file_name": "Group Psychotherapy as a Neural Exercise Bridging Polyvagal Theory and Attachment Theory.pdf"
  },
  {
    "file_name": "Group Therapy for Patients in Chronic Pain 11.3.21.pptx"
  },
  {
    "file_name": "Halaris.8.4.21.Mental Pain.mp4"
  },
  {
    "file_name": "Hanscom.10.11.20.chat.txt"
  },
  {
    "file_name": "Hanscom.10.11.20.txt"
  },
  {
    "file_name": "Hanscom.11.11.20.mp4"
  },
  {
    "file_name": "Hanscom.Clawson.docx"
  },
  {
    "file_name": "Hanscom Pain 092023.pptx"
  },
  {
    "file_name": "Harris.CV.docx"
  },
  {
    "file_name": "HEADACHEPUBLISHED.pdf"
  },
  {
    "file_name": "Heather Abernathy Announcement.docx"
  },
  {
    "file_name": "Horn.Carter.10.5.22.docx"
  },
  {
    "file_name": "Horn.Carter.10.5.22.mp4"
  },
  {
    "file_name": "Horn.Carter.1.19.22.OXY.Love.Longevity.mp4"
  },
  {
    "file_name": "HornCarter.Love&Longevity.cPNEC2021.pdf"
  },
  {
    "file_name": "Horn.Fasting.9.6.23.mp4"
  },
  {
    "file_name": "Horn.OXY.VSP.PTSD.2024.pdf"
  },
  {
    "file_name": "Hoverman.12.18.24.mp4"
  },
  {
    "file_name": "Hoverman Announcement.docx"
  },
  {
    "file_name": "HovermanSocialPrescribing24.pdf"
  },
  {
    "file_name": "HubbardD.Muscletensionandchronicmusclepainsummmaryoftheory.ClinicalSurfaceEMGConferenceKeyWestFLFeb41996.pdf"
  },
  {
    "file_name": "Hyperkatifeia and Despair 2021.pdf"
  },
  {
    "file_name": "Hypnotherapy.Speigel.docx"
  },
  {
    "file_name": "Ian Harris.MSK Surgery and Pain.5.4.22.mp4"
  },
  {
    "file_name": "Ian Harris References.docx"
  },
  {
    "file_name": "Impact activites.docx"
  },
  {
    "file_name": "Inflammation and the Vagus Nerve.pptx"
  },
  {
    "file_name": "Interaction between immune and central nervous system.docx"
  },
  {
    "file_name": "Ions_Spontaneous_Remissions.docx"
  },
  {
    "file_name": "Isaac Fradkin Announcement.docx"
  },
  {
    "file_name": "Jake Eagle.Contact.docx"
  },
  {
    "file_name": "Jake Eagle.Cytokines.docx"
  },
  {
    "file_name": "jamapsychiatry_phelps_2022_psychadelics.pdf"
  },
  {
    "file_name": "James Pennebaker announcement.docx"
  },
  {
    "file_name": "Jennifer Franklin.docx"
  },
  {
    "file_name": "John Cryan.docx"
  },
  {
    "file_name": "Kate Wolovsky.2.3.21.mp4"
  },
  {
    "file_name": "kateWolovsky Links.docx"
  },
  {
    "file_name": "Katie Guttenberg.Cortisol.docx"
  },
  {
    "file_name": "KearneyLanius2022.p.Brain.Body disconnect.df.pdf"
  },
  {
    "file_name": "Kevin Tracey Seminar.docx"
  },
  {
    "file_name": "Kjaervik.Anger review.2024.pdf"
  },
  {
    "file_name": "Kolacz, Kovacic, and Porges 2019 ANS brain-gut .pdf"
  },
  {
    "file_name": "Lane.APS Presidential Address 2008.pdf"
  },
  {
    "file_name": "Lane Biased Competition PM 2018.pdf"
  },
  {
    "file_name": "Lane et al Affective Agnosia NBR 2015.pdf"
  },
  {
    "file_name": "Lane.Neural Substrates of Implicit and Explicit Emotional Processes.docx"
  },
  {
    "file_name": "Langenecker.Rumination.CBT.fMRI.2023.pdf"
  },
  {
    "file_name": "Lanius Announcement.docx"
  },
  {
    "file_name": "LaniusetalSelf.PTSD.2020.pdf"
  },
  {
    "file_name": "Lederman.4.4.24.mp4"
  },
  {
    "file_name": "Lederman Announcement.docx"
  },
  {
    "file_name": "Lessons from Osler.docx"
  },
  {
    "file_name": "Les.Steve.9.7.22.docx"
  },
  {
    "file_name": "Liz Baker.11.3.21.mp4"
  },
  {
    "file_name": "Liz Baker Announcement.docx"
  },
  {
    "file_name": "LongCOVID.Frontiers.final.PDF"
  },
  {
    "file_name": "Lourdes Dale Announcement.docx"
  },
  {
    "file_name": "Luskin.3.17.21.mp4"
  },
  {
    "file_name": "Lustig.Amygdala.1.8.25.mp4"
  },
  {
    "file_name": "Lustig Announcement.docx"
  },
  {
    "file_name": "Lustig.Metabolism.Inflammation.Sugar.mp4"
  },
  {
    "file_name": "Lydia Temoshok Bio.docx"
  },
  {
    "file_name": "Marilyn Sanders.10.20.21.mp4"
  },
  {
    "file_name": "Marilyn Sanders Announcement.10.18.21docx.docx"
  },
  {
    "file_name": "Marjorie Wolcott.docx"
  },
  {
    "file_name": "Mark Andrew Tarnopolsky mini CV.docx"
  },
  {
    "file_name": "Mark Tarnopolsky Announcement.docx"
  },
  {
    "file_name": "Marsland.Childhood trauma and hair cortisol response over the year following onset of a chronic life event st.pdf"
  },
  {
    "file_name": "Martin Picard.docx"
  },
  {
    "file_name": "Marty Teicher.docx"
  },
  {
    "file_name": "Matt and Alona.10.21.20.mp4"
  },
  {
    "file_name": "Matt Lederman.mp4"
  },
  {
    "file_name": "MD.Wellness.RUTS.pptx"
  },
  {
    "file_name": "MedSchoolTraining.WHitaker.mp4"
  },
  {
    "file_name": "Meehan.Somatic Practices Review.CP.2021.pdf"
  },
  {
    "file_name": "meeting_saved_chat.txt"
  },
  {
    "file_name": "meeting_saved_new_chat.txt"
  },
  {
    "file_name": "Meeting Summary.pdf"
  },
  {
    "file_name": "Meghan O'Rourke.docx"
  },
  {
    "file_name": "Mel Pohl intro.docx"
  },
  {
    "file_name": "Meredith.10.18.23.mp4"
  },
  {
    "file_name": "Meredith 2016 Attachment and Pain Chapter copy.pdf"
  },
  {
    "file_name": "Meredith.Attach.CP.coldpressor.2006.pdf"
  },
  {
    "file_name": "Meredith.Sensory attachment.CP.2021.pdf"
  },
  {
    "file_name": "Metabolic and Mental Health Seminar.pptx"
  },
  {
    "file_name": "Monty Lyman.docx"
  },
  {
    "file_name": "Myopain_slides.3.19.25.pdf"
  },
  {
    "file_name": "Napadow.Announcement.docx"
  },
  {
    "file_name": "Navaux.4.17.24.mp4"
  },
  {
    "file_name": "Naviaux.3.2.22.Mito.metab.mp4"
  },
  {
    "file_name": "Naviaux.4.21.21.mp4"
  },
  {
    "file_name": "Naviaux Aging & Incomplete Healing 2019.pdf"
  },
  {
    "file_name": "Naviaux Announcement.3.2.22.docx"
  },
  {
    "file_name": "Naviaux Bio Blurb April 2021.pdf"
  },
  {
    "file_name": "Naviaux.CDR.stress.chronic disease.2020"
  },
  {
    "file_name": "Naviaux.CDR.stress.chronic disease.2020.pdf"
  },
  {
    "file_name": "Naviaux.DR.1.24.24.mp4"
  },
  {
    "file_name": "Naviaux.DR.docx"
  },
  {
    "file_name": "Naviaux Hanscom Talk #4.pptx"
  },
  {
    "file_name": "Naviaux_MECFS_Metabolic_2016.pdf"
  },
  {
    "file_name": "Naviaux.Mitochondria.chronic Disease.mp4"
  },
  {
    "file_name": "Naviaux Mito Environmental Toxicology_2020.pdf"
  },
  {
    "file_name": "Naviaux.Nematodes.Dauer.docx"
  },
  {
    "file_name": "Naviauz.CDR.Review.AI.docx"
  },
  {
    "file_name": "Neff 2020 SCHC.pdf"
  },
  {
    "file_name": "Neil.Nathan.11.16.22.mp4"
  },
  {
    "file_name": "Nixon.Human.Function.Curve.to.Chronic.Pain.Gharbo.2013.docx"
  },
  {
    "file_name": "Nocebo-Pain Killer effects.pdf"
  },
  {
    "file_name": "Nociplastic Pain.Summary.Clauw.docx.pdf"
  },
  {
    "file_name": "NPDG.Comments.9.23.20.docx"
  },
  {
    "file_name": "NP.Discussion Group..6.24.20.mp4"
  },
  {
    "file_name": "On the Role of Death in Life.pptx"
  },
  {
    "file_name": "Open Discussion.5.19.21.docx"
  },
  {
    "file_name": "OpenDiscuss.PVT.CNS.6.24.20.mp4"
  },
  {
    "file_name": "Optispan.Prevention Live Longer Better (Healthspan) Dec 2023.pdf"
  },
  {
    "file_name": "Ottaviani.Perseverative Cog and ANS.2025.pdf"
  },
  {
    "file_name": "Overman.11.17.21.mp4"
  },
  {
    "file_name": "Overman.docx"
  },
  {
    "file_name": "Overman.Phases of Pain.docx"
  },
  {
    "file_name": "Oxytocin and the ANS- Abstracted from Pharm Rev.docx"
  },
  {
    "file_name": "Oxytocin-enhanced group therapy for methamphetamine use disorder: Randomized controlled trial - PubM.pdf"
  },
  {
    "file_name": "Oxytocin,neuromod7.29.20.mp4"
  },
  {
    "file_name": "Panda.circadian.medicine.10.16.24.mp4"
  },
  {
    "file_name": "Pandi.2.24.21.mp4"
  },
  {
    "file_name": "Pandi.Annonce.Circadian Rhythm for Healthy Lifespan.docx"
  },
  {
    "file_name": "Pandi_Resume.pdf"
  },
  {
    "file_name": "Paul Anderson Announcement.docx"
  },
  {
    "file_name": "Pennebaker.10.19.22.mp4"
  },
  {
    "file_name": "Pennebaker.4.2.25.Expressive Writing and Language Analysis.docx"
  },
  {
    "file_name": "Pennebaker.4.3.25.mp4"
  },
  {
    "file_name": "Pennebaker Announcement.4.2.25.docx"
  },
  {
    "file_name": "Peper.11.21.24.mp4"
  },
  {
    "file_name": "Peter Staats Announcement.docx"
  },
  {
    "file_name": "Phillips-Hine-2019.-Self-compassion-health-meta-analysis.pdf"
  },
  {
    "file_name": "Poly..Cytokies.oxytocin.5.13.20.docx"
  },
  {
    "file_name": "Polyvagal Pennebaker f:up.docx"
  },
  {
    "file_name": "Polyvagal Theory and the Developing Child.docx"
  },
  {
    "file_name": "Polyvagal Wednesday 2020.docx"
  },
  {
    "file_name": "Porges.1.20.21.2.txt"
  },
  {
    "file_name": "Porges.1.20.21.mp4"
  },
  {
    "file_name": "Porges.1.20.21.txt"
  },
  {
    "file_name": "Porges - EVP- Mind-Body Issues.pptx"
  },
  {
    "file_name": "Porges.Lederman.Acute Pain.mp4"
  },
  {
    "file_name": "Porges.Pain.9.17.20.ANS.physiological.platfrom.docx"
  },
  {
    "file_name": "Porges.Poly.8.19.20.mp4"
  },
  {
    "file_name": "Porges.PVTCP.Oxy.9.30.20.txt"
  },
  {
    "file_name": "Porges Slides PVT Overview.pdf"
  },
  {
    "file_name": "Post Covid-19 Syndrome.pptx"
  },
  {
    "file_name": "Power of No.Peper.Stockdale.docx"
  },
  {
    "file_name": "Professor Dr.announcement.docx"
  },
  {
    "file_name": "Protein Animations.docx"
  },
  {
    "file_name": "Psychological Insight.pdf"
  },
  {
    "file_name": "PTSD-NeurofeedbackRemedy.pdf"
  },
  {
    "file_name": "PVG.11.18.20.Announcement.docx"
  },
  {
    "file_name": "PVT.Cytokines.Oxytocin.5.13.20.mp4"
  },
  {
    "file_name": "Raison_Depression_Evolution_defense_2012.pdf"
  },
  {
    "file_name": "RCW_academic_CV_CU.pdf"
  },
  {
    "file_name": "recording.conf"
  },
  {
    "file_name": "Richard Gevirtz.Study.docx"
  },
  {
    "file_name": "Richard Lane Announcement.docx"
  },
  {
    "file_name": "Richard Wilkinson announcement..docx"
  },
  {
    "file_name": "Ring of Fire.7.7.20.mp4"
  },
  {
    "file_name": "Robert Dantzer.mp4"
  },
  {
    "file_name": "Robert Dantzer.neuroinflammation.docx"
  },
  {
    "file_name": "Robert Naviaux Announcemennt.docx"
  },
  {
    "file_name": "RonGharbo.12.2.20.mp4"
  },
  {
    "file_name": "Ron Gharbo Summary.1.27.21.docx"
  },
  {
    "file_name": "Rosenberg.Stress.GreyHair.2021.pdf"
  },
  {
    "file_name": "Rowena Field.3.1.23.mp4"
  },
  {
    "file_name": "Rowena Field Announcement.docx"
  },
  {
    "file_name": "Rubin.CPR.Sex.race.JAMA.pdf"
  },
  {
    "file_name": "s41591-019-0675-0.pdf"
  },
  {
    "file_name": "Sabey.11.1.23.Positive Programming.mp4"
  },
  {
    "file_name": "Sanders.Bio.2021.docx"
  },
  {
    "file_name": "Sanders chapterPorgesDana.pdf"
  },
  {
    "file_name": "Sanders_et_al-2017-Journal_of_Perinatology.pdf"
  },
  {
    "file_name": "Sapio Cortex, Threat, and Human Physiology.Clawson.docx.pdf"
  },
  {
    "file_name": "Satchin_Panda_CircadianHealth_20241016.pptx"
  },
  {
    "file_name": "Schubiner.1.13.21.b.txt"
  },
  {
    "file_name": "Schubiner.1.13.21.mp4"
  },
  {
    "file_name": "Schubiner.1.13.21.txt"
  },
  {
    "file_name": "SC in Therapy pdf -  Germer 7-6-21.pdf"
  },
  {
    "file_name": "Scott Langenecker announcement.docx"
  },
  {
    "file_name": "Seattle with Steve 2024.pptx"
  },
  {
    "file_name": "Self-Compassion and Shame Hanscom Sept 2021.pptx"
  },
  {
    "file_name": "Sensory sensitivity and symptom severity represent unique dimensions of chronic pain_ a MAPP Research Network study (1).pdf"
  },
  {
    "file_name": "Sept 20 2023 presentation with Dr Lanev2.pptx"
  },
  {
    "file_name": "SE RCT.pdf"
  },
  {
    "file_name": "Sheldon Solomon Announcement.docx"
  },
  {
    "file_name": "Sheldon Solomon.docx"
  },
  {
    "file_name": "Simonsson.1.9.22.mp4"
  },
  {
    "file_name": "Simonsson et al., 2021.pdf"
  },
  {
    "file_name": "Simonsson.Psychedelics.Cardiometabolic.2021.Nature.pdf"
  },
  {
    "file_name": "Simonsson.Psychs.meditation.2022.pdf"
  },
  {
    "file_name": "Smigielski et al., 2019.pdf"
  },
  {
    "file_name": "Smith EA_EVO_2020.pdf"
  },
  {
    "file_name": "Social Engagement and Attachment(red).pdf"
  },
  {
    "file_name": "Social Prescribing.AI summary.pdf"
  },
  {
    "file_name": "social-prescribing-around-the-world-2024.pdf"
  },
  {
    "file_name": "Social RX.Stephen Bezrushka.docx"
  },
  {
    "file_name": "Solosmon_The Worm at the Core.pdf"
  },
  {
    "file_name": "Somatic Meta 2020 .pdf"
  },
  {
    "file_name": "Sommer-Anderson.mp4"
  },
  {
    "file_name": "Sophia Hayes.docx"
  },
  {
    "file_name": "Sophie Kjaervik Announcement.docx"
  },
  {
    "file_name": "Springer.Trauma of a Divided Nation.docx"
  },
  {
    "file_name": "Staats.Clawson.Announcement.docx"
  },
  {
    "file_name": "Staats.Clawson.mp4"
  },
  {
    "file_name": "Stange.rMDD.CCN.cognition.pdf"
  },
  {
    "file_name": "Stellate Blocks.Lipov.Springer.8.12.20.mp4"
  },
  {
    "file_name": "Stellate Blocks.Roundtable.docx"
  },
  {
    "file_name": "Stephen Bezruchka announcement.docx"
  },
  {
    "file_name": "Steve Cole.6.3.21.mp4"
  },
  {
    "file_name": "Steve Cole.Social Expression.#2.mp4"
  },
  {
    "file_name": "Steve Cole Transcript and Recording.docx"
  },
  {
    "file_name": "Steve Overman Comments.docx"
  },
  {
    "file_name": "Stockdale_Seigel_2.19.25.mp4"
  },
  {
    "file_name": "STPP Somatic All.pdf"
  },
  {
    "file_name": "Sue Carter Announcement.5.5.21.docx"
  },
  {
    "file_name": "Sue Carter.SexDiff.CP.mp4"
  },
  {
    "file_name": "Sue Carter talk 9-21-2022.mp4"
  },
  {
    "file_name": "Sullivan.Ballantyne.5.3.23.mp4"
  },
  {
    "file_name": "Sullivan.Ballantyne.Announce.docx"
  },
  {
    "file_name": "Sullivan_biosketch doctor 4-12-22.docx"
  },
  {
    "file_name": "Summary of Brenda Stockdale_Bernie Seigel"
  },
  {
    "file_name": "Summary of Brenda Stockdale_Bernie Seigel.pdf"
  },
  {
    "file_name": "Summary of Klauw.presentation.1.26.25.docx"
  },
  {
    "file_name": "surgeon-general-social-connection-advisory.pdf"
  },
  {
    "file_name": "Surgery_for_chronic_musculoskeletal_pain__the.10.pdf"
  },
  {
    "file_name": "SurvivingTerminalCancer_Stockdale_Siegel.docx"
  },
  {
    "file_name": "Sutphinb.10.6.24.mp4"
  },
  {
    "file_name": "Tamara Turner Announcement.docx"
  },
  {
    "file_name": "Tang.SCFA.Pain.2024.pdf"
  },
  {
    "file_name": "Tao.Depression uncouples hate.pdf"
  },
  {
    "file_name": "Tarnppolsky12.15.21.mp4"
  },
  {
    "file_name": "Tauben.Sullivan.4.20.22.mp4"
  },
  {
    "file_name": "Tauben.Sullivan.docx"
  },
  {
    "file_name": "Teicher_ACE:BrainStructure.pdf"
  },
  {
    "file_name": "Teixeira et al., 2021.pdf"
  },
  {
    "file_name": "Temoshok 2008 Brain Behavior & Immunity (1).pdf"
  },
  {
    "file_name": "Terror Management Theory.Summary.4.16.25.pdf"
  },
  {
    "file_name": "Terry Miller Announcement.docx"
  },
  {
    "file_name": "The Care of the Patient — NEJM  1947  Kattwinkel.pdf"
  },
  {
    "file_name": "Three questions.Clauw.docx"
  },
  {
    "file_name": "Topics.Chronic Disease Discussion Group.2022.docx"
  },
  {
    "file_name": "Topics.DHDG.WorkingDraft.2022-2023.docx"
  },
  {
    "file_name": "Transcript - Brenda Stockdale - 2-19-2025.pdf"
  },
  {
    "file_name": "Tribal Therapy.9.2.20.mp4"
  },
  {
    "file_name": "Turner.Affective.Musical.Haunting.Algeria.2021.pdf"
  },
  {
    "file_name": "Turner, Ethos.pdf"
  },
  {
    "file_name": "TVST - OCD and mitos.pdf"
  },
  {
    "file_name": "Type C Coping.docx"
  },
  {
    "file_name": "Valery Grinevich 2-4-2024 video.mp4"
  },
  {
    "file_name": "Valery Oxytocin Feb 2024.docx"
  },
  {
    "file_name": "Veronique.Trauma informed Rx.docx"
  },
  {
    "file_name": "video1168985783.mp4"
  },
  {
    "file_name": "video1202452101.mp4"
  },
  {
    "file_name": "Wager.2.1.23.mp4"
  },
  {
    "file_name": "Wager.7.15.20.mp4"
  },
  {
    "file_name": "Wager Announcement.docx"
  },
  {
    "file_name": "Wager.Intro.Networks.Intro.6.17.20.mp4"
  },
  {
    "file_name": "Wager.Placebo.2.2.22.mp4"
  },
  {
    "file_name": "WBC references.docx"
  },
  {
    "file_name": "Wednesday PVT group.docx"
  },
  {
    "file_name": "Wed PM.10.11.20.pptx"
  },
  {
    "file_name": "What is Needed to Promote the Uptake and Implementation of Social Prescribing_KGC.pdf"
  },
  {
    "file_name": "Whitaker_RC_narrative_bio_10_2018.pdf"
  },
  {
    "file_name": "Whitaker.RelationshipsHeal.2015..pdf"
  },
  {
    "file_name": "White blood cell count as a predictor of mortality: results over 18 years from the Normative Aging S.pdf"
  },
  {
    "file_name": "Why Americans Feel More Pain.NYT.5.3.23.docx"
  },
  {
    "file_name": "Wood.Pain.Purines.Geoff.pdf"
  },
  {
    "file_name": "Woolf.Bezruchka.docx"
  },
  {
    "file_name": "Yoni Asher.2.15.23.mp4"
  },
  {
    "file_name": "Yoni Asher announcement.docx"
  },
  {
    "file_name": "Youtube LInks for Tamara's talk.docx"
  },
  {
    "file_name": "Ziderman_DD_meditators_self_dissolution_preprint_21.8.23.pdf"
  },
  {
    "file_name": "Ziderman_Prediction based neural mechanisms for shielding the self from existential threat.pdf"
  }
]