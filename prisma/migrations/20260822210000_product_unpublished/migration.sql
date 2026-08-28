-- "Taken back down" is a different state from "never reviewed", and staff
-- need to tell them apart when triaging the catalogue.
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'UNPUBLISHED';
