import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { describeShareFailure } from './providerTracking';

describe('describeShareFailure', () => {
  it('names a backend that does not know the tracking route yet', () => {
    // What `request()` builds when the route is missing entirely: the status is
    // in the message, the body has no `error` field, so there is no code.
    const err = new ApiError('API 404', 404);

    expect(describeShareFailure(err)).toMatch(/backend does not support live tracking/i);
  });

  it('names a journey the server no longer treats as on-the-way', () => {
    const err = new ApiError('Live tracking is only active while the journey is on the way', 409, 'tracking_not_active');

    expect(describeShareFailure(err)).toMatch(/on-the-way/i);
  });

  it('separates a booking the server does not recognise from a missing route', () => {
    const err = new ApiError('Booking not found', 404);

    expect(describeShareFailure(err)).toMatch(/does not recognise this booking/i);
  });

  it('names an expired session', () => {
    expect(describeShareFailure(new ApiError('Missing Authorization header', 401))).toMatch(/session has expired/i);
    expect(describeShareFailure(new ApiError('Forbidden', 403))).toMatch(/session has expired/i);
  });

  it('passes a real network failure through as the backend worded it', () => {
    const offline = new ApiError('You appear to be offline. Reconnect and try again.', 0, 'network');

    expect(describeShareFailure(offline)).toBe('You appear to be offline. Reconnect and try again.');
  });

  it('never returns an empty message', () => {
    expect(describeShareFailure(new ApiError('', 500))).toBe('Could not share your location.');
    expect(describeShareFailure(undefined)).toBe('Could not share your location.');
  });
});
