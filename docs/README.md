# Fergus-Airtable Sync Documentation

This directory contains comprehensive documentation for the Fergus-Airtable sync system.

## Available Documentation

### Core Documentation
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and update details
- **[fergus-api-documentation.md](fergus-api-documentation.md)** - Complete API reference
- **[invoice-handling.md](invoice-handling.md)** - Guide to invoice detection and syncing
- **[fergus-structure.md](fergus-structure.md)** - Overview of Fergus data structure

### Feature-Specific Documentation
- **[address-handling.md](address-handling.md)** - How address data is processed and normalized
- **[completed-jobs-handling.md](completed-jobs-handling.md)** - Details on completed job processing
- **[quote-followup-workflow.md](quote-followup-workflow.md)** - Workflow for quote follow-ups

### Planning and Roadmap
- **[fergus-automation-roadmap.md](fergus-automation-roadmap.md)** - Future development plans

## Key Concepts

### 1. Authentication

The system uses cookie-based authentication to access the Fergus API. Cookies need to be periodically refreshed (typically every few weeks).

### 2. Syncing Strategy

The system employs three main scripts:
- **incremental-sync.js** - Daily updates for jobs that have changed
- **sync-fergus-invoices.js** - Focused invoice syncing 2-3 times weekly
- **direct-fergus-api.js** - Weekly full sync of all data

### 3. Data Flow

```
Fergus API → Script Processing → Airtable Base
```

1. Data is fetched from various Fergus API endpoints
2. Data is processed, normalized, and formatted
3. Data is synced to Airtable using upsert operations (update or create)

### 4. Error Handling

The system implements robust error handling including:
- Connection retry logic
- Rate limit handling
- Malformed data detection
- Logging and debugging

## Troubleshooting

For common issues, refer to the Troubleshooting section in the main [README.md](../README.md). 