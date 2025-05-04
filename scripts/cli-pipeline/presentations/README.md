# Presentations CLI Pipeline

The presentations CLI pipeline provides commands for managing expert presentations, including generating AI summaries from transcriptions, creating expert profiles, and managing presentation assets.

## Available Commands

- `review-presentations` - Review presentation status, document types, and content
- `generate-summary` - Generate AI summaries from presentation transcripts using Claude
- `generate-expert-bio` - Generate AI expert bio/profile from presentation content
- `check-professional-docs` - Check for professional documents associated with presentations
- `create-missing-assets` - Create missing presentation_asset records
- `export-status` - Export presentation transcription status to markdown
- `repair-presentations` - Repair presentations with missing main_video_id
- `create-from-expert-docs` - Create presentations from expert documents
- `scan-for-ai-summaries` - Scan for documents that need AI summarization
- `show-missing-content` - Show presentations without content that need reprocessing

## Usage

Run commands using the presentations-cli.sh script:

```bash
./presentations-cli.sh COMMAND [options]
```

For help on all commands:

```bash
./presentations-cli.sh --help
```

For help on a specific command:

```bash
./presentations-cli.sh COMMAND --help
```

## Helper Scripts

- `help-update-ai-status.sh` - Updates expert documents in the Dynamic Healing Discussion Group to have 'pending' AI summary status

## Common Workflows

### Generating AI Summaries

1. Scan for documents needing AI summaries:
   ```bash
   ./presentations-cli.sh scan-for-ai-summaries
   ```

2. Update documents to have 'pending' status using either:
   ```bash
   ./help-update-ai-status.sh
   ```
   or
   ```bash
   ./presentations-cli.sh scan-for-ai-summaries --update-dhg
   ```

3. Generate summaries for pending documents:
   ```bash
   ./presentations-cli.sh generate-summary --status pending --limit 10
   ```

### Reviewing Presentation Status

To review presentation status and export a report:
```bash
./presentations-cli.sh export-status
```

### Creating Missing Assets

To create missing presentation asset records:
```bash
./presentations-cli.sh create-missing-assets
```