-- Add columns for visual positioning of parcels on the map
-- These will be used for NEW or MOVED parcels. 
-- Existing parcels will fallback to hardcoded coordinates if these are NULL.

ALTER TABLE parcelas 
ADD COLUMN IF NOT EXISTS pos_x NUMERIC,
ADD COLUMN IF NOT EXISTS pos_y NUMERIC;

COMMENT ON COLUMN parcelas.pos_x IS 'Horizontal position percentage (0-100) for custom map placement';
COMMENT ON COLUMN parcelas.pos_y IS 'Vertical position percentage (0-100) for custom map placement';
