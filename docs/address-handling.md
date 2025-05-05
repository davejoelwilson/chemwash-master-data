# Address Handling in Fergus to Airtable Sync

This document explains how addresses are handled in the Fergus to Airtable sync process.

## Address Types in Fergus

Fergus jobs have two primary address types:

1. **Site Address**: The location where the work is performed. This is associated with the job itself.
2. **Billing/Customer Address**: The customer's address for billing purposes. This can be different from the site address.

## Address Formats in Fergus API

The Fergus API returns addresses in two different formats:

1. **Object Format**:
   ```json
   "site_address": {
     "id": 46867565,
     "contact_type": "JOB",
     "address_1": "38 Arthur Street",
     "address_2": "",
     "address_suburb": "Freemans Bay",
     "address_city": "Auckland",
     "address_region": "Auckland",
     "address_country": "New Zealand",
     "address_postcode": "1011"
   }
   ```

2. **String Format**:
   ```json
   "site_address": "161 Richardson Road Mount Albert Auckland 1025"
   ```

## Billing Address Sources

The billing address can be found in several places in the customer object:

1. **Billing Contact**: `job.customer.billing_contact`
2. **Postal Address**: `job.customer.postal_address` 
3. **Physical Address**: `job.customer.physical_address`

The sync process checks these in order and uses the first one that contains address data.

## Address Handling in Airtable

The sync process stores the following address fields in Airtable:

1. **Site Address**: The full site address as a string
2. **Suburb**: The suburb extracted from the site address
3. **City**: The city extracted from the site address
4. **Billing Address**: The full billing address as a string

## Address Extraction Logic

### For Object Format Addresses

When the address is in object format, we extract the parts directly:

```javascript
const siteSuburb = mergedJob.site_address.address_suburb || '';
const siteCity = mergedJob.site_address.address_city || '';
```

### For String Format Addresses

When the address is a string, we attempt to extract the suburb and city:

```javascript
const addressParts = mergedJob.site_address.split(',');
if (addressParts.length >= 3) {
  // Assume format is like "Street, Suburb, City Postcode"
  siteSuburb = addressParts[1].trim();
  const cityPart = addressParts[2].trim();
  siteCity = cityPart.split(' ')[0] || cityPart;
}
```

For addresses without commas, we use a more complex extraction method that looks for known suburbs and cities in the address string.

## Adding the Fields to Airtable

Before running the sync, you need to make sure the following fields exist in your Airtable "Jobs" table:

1. **Site Address**: Already exists in most setups
2. **Suburb**: New field needed
3. **City**: New field needed
4. **Billing Address**: New field needed

You can run the `add-airtable-fields.js` script to check which fields you need to add.

## Testing Address Extraction

To test how addresses are extracted for a specific job, use the `test-job-addresses.js` script:

```bash
node test-job-addresses.js JOB_ID
```

This will show you:
- The full site address
- The extracted suburb and city
- The billing address
- Whether the site and billing addresses are different

## Common Issues

1. **String Addresses Without Commas**: These are the hardest to extract suburb and city from. The code tries to recognize known suburbs and cities.

2. **Missing Billing Addresses**: Some customers don't have complete address information. In these cases, the billing address field may be empty.

3. **Different Address Formats**: Since the address can be either an object or a string, the extraction logic needs to handle both formats.

## Example of Different Addresses

In many cases, the site address and billing address are different. For example:

```
Site address: 9 Peachgrove Road, Te Atatu Peninsula, Auckland
Billing address: PO Box 50662, Porirua, 5240
```

This is why it's important to track both addresses in Airtable. 