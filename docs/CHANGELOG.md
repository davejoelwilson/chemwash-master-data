# Changelog

## v1.2.0 (Current)

### Added
- Invoice detection and syncing capabilities
- Extraction of invoice IDs from status_board/data endpoint
- Works order tracking and processing 
- Detailed invoice data fetching from multiple endpoints
- Customer invoice tracking and processing
- Sample data saving for debugging and analysis

### Improved
- Robust error handling for invoice processing
- Data formatting for Airtable integration
- Job prioritization algorithm for better invoice discovery
- Concurrent processing for handling multiple jobs simultaneously

### Fixed
- Invoice detection approach by exploring alternative endpoints
- Works order handling and data extraction
- Invalid date formatting in invoice records

## v1.1.0

### Added
- Status change tracking to monitor job progression
- Concurrent processing to handle multiple jobs simultaneously
- Job status filtering for targeted sync
- Non-active job handling

### Improved
- Cookie-based authentication system
- Airtable field mapping
- Error handling and retry logic

### Fixed
- Address formatting issues
- Job status synchronization
- Customer data handling

## v1.0.0

### Added
- Initial implementation of Fergus to Airtable sync
- Job data fetching from Fergus API
- Basic Airtable integration
- Upsert functionality (update existing or create new records)
- Authentication system for accessing Fergus API 