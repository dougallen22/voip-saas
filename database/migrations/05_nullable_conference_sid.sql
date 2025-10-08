-- Make twilio_conference_sid nullable since it may not be available immediately
ALTER TABLE parked_calls ALTER COLUMN twilio_conference_sid DROP NOT NULL;
