-- Shorten existing vendor access tokens from 32 chars to 8 chars
UPDATE hojo_vendors SET access_token = LEFT(access_token, 8) WHERE LENGTH(access_token) > 8;
