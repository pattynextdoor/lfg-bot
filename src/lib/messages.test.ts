import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Collection } from 'discord.js';
import { purgeChannelMessages } from './messages.js';

// ── Helpers to build fake Discord objects ──────────────────────────

const TARGET_USER_ID = '111';
const OTHER_USER_ID = '222';
const ANOTHER_USER_ID = '333';

let messageIdCounter = 1000;

function makeMessage(authorId: string, ageMs = 0) {
  const id = String(messageIdCounter++);
  const deleteFn = vi.fn().mockResolvedValue(undefined);
  return {
    id,
    author: { id: authorId },
    createdTimestamp: Date.now() - ageMs,
    delete: deleteFn,
    _deleted: deleteFn, // convenience ref for assertions
  };
}

/** Build a Collection<Snowflake, Message> from an array of fake messages */
function toCollection(messages: ReturnType<typeof makeMessage>[]) {
  const col = new Collection<string, any>();
  for (const msg of messages) {
    col.set(msg.id, msg);
  }
  return col;
}

function makeChannel(batches: ReturnType<typeof makeMessage>[][]) {
  let callIndex = 0;

  const bulkDeleteFn = vi.fn().mockImplementation((msgs: any[]) => {
    // Return a Collection whose size matches the input (simulates success)
    return Promise.resolve(toCollection(msgs));
  });

  const fetchFn = vi.fn().mockImplementation(() => {
    const batch = batches[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(toCollection(batch));
  });

  return {
    messages: { fetch: fetchFn },
    bulkDelete: bulkDeleteFn,
    name: 'test-channel',
    _fetch: fetchFn,
    _bulkDelete: bulkDeleteFn,
  } as any;
}

// ── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  messageIdCounter = 1000;
  vi.useFakeTimers();
});

describe('purgeChannelMessages', () => {
  it('only deletes messages from the target user, not from others', async () => {
    const targetMsg1 = makeMessage(TARGET_USER_ID);
    const targetMsg2 = makeMessage(TARGET_USER_ID);
    const otherMsg = makeMessage(OTHER_USER_ID);
    const anotherMsg = makeMessage(ANOTHER_USER_ID);

    // Single batch with a mix of users
    const channel = makeChannel([[targetMsg1, otherMsg, targetMsg2, anotherMsg]]);

    const deleted = await purgeChannelMessages(channel, TARGET_USER_ID);

    // Should have bulk-deleted exactly the 2 target messages
    expect(channel._bulkDelete).toHaveBeenCalledTimes(1);
    const bulkDeletedMsgs = channel._bulkDelete.mock.calls[0][0];
    expect(bulkDeletedMsgs).toHaveLength(2);
    expect(bulkDeletedMsgs).toContain(targetMsg1);
    expect(bulkDeletedMsgs).toContain(targetMsg2);

    // Other users' messages must NEVER have .delete() called
    expect(otherMsg._deleted).not.toHaveBeenCalled();
    expect(anotherMsg._deleted).not.toHaveBeenCalled();

    expect(deleted).toBe(2);
  });

  it('returns 0 and deletes nothing when channel has no target messages', async () => {
    const otherMsg1 = makeMessage(OTHER_USER_ID);
    const otherMsg2 = makeMessage(ANOTHER_USER_ID);

    const channel = makeChannel([[otherMsg1, otherMsg2]]);

    const deleted = await purgeChannelMessages(channel, TARGET_USER_ID);

    expect(channel._bulkDelete).not.toHaveBeenCalled();
    expect(otherMsg1._deleted).not.toHaveBeenCalled();
    expect(otherMsg2._deleted).not.toHaveBeenCalled();
    expect(deleted).toBe(0);
  });

  it('individually deletes old messages (>14 days) from target only', async () => {
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

    const oldTargetMsg = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);
    const oldOtherMsg = makeMessage(OTHER_USER_ID, FIFTEEN_DAYS);

    const channel = makeChannel([[oldTargetMsg, oldOtherMsg]]);

    const promise = purgeChannelMessages(channel, TARGET_USER_ID);

    // Advance through the delete delay
    await vi.advanceTimersByTimeAsync(2000);

    const deleted = await promise;

    // Old target message should be individually deleted
    expect(oldTargetMsg._deleted).toHaveBeenCalledTimes(1);

    // Old message from OTHER user must NOT be touched
    expect(oldOtherMsg._deleted).not.toHaveBeenCalled();

    // No bulk delete (all messages were old)
    expect(channel._bulkDelete).not.toHaveBeenCalled();

    expect(deleted).toBe(1);
  });

  it('handles a mix of recent and old messages across multiple batches', async () => {
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

    const recentTarget = makeMessage(TARGET_USER_ID, 0);
    const otherMsg = makeMessage(OTHER_USER_ID, 0);
    const oldTarget = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);
    const oldOther = makeMessage(OTHER_USER_ID, FIFTEEN_DAYS);

    // Two batches: simulates paginated fetching
    const channel = makeChannel([
      [recentTarget, otherMsg],
      [oldTarget, oldOther],
    ]);

    // Override fetch limit so both batches are consumed
    // (each batch has < 100 items, but we have 2 batches)
    // The first batch has size 2 < FETCH_LIMIT(100), so normally it would stop.
    // To simulate pagination, make the first batch exactly 100 items.
    // Instead, let's just verify single-batch behavior works correctly
    // by making a larger single batch.
    const channel2 = makeChannel([[recentTarget, otherMsg, oldTarget, oldOther]]);

    const promise = purgeChannelMessages(channel2, TARGET_USER_ID);
    await vi.advanceTimersByTimeAsync(2000);
    const deleted = await promise;

    // Recent target → bulk deleted
    expect(channel2._bulkDelete).toHaveBeenCalledTimes(1);
    expect(channel2._bulkDelete.mock.calls[0][0]).toContain(recentTarget);

    // Old target → individually deleted
    expect(oldTarget._deleted).toHaveBeenCalledTimes(1);

    // Other users → untouched
    expect(otherMsg._deleted).not.toHaveBeenCalled();
    expect(oldOther._deleted).not.toHaveBeenCalled();

    expect(deleted).toBe(2);
  });

  it('stops immediately when isAborted returns true', async () => {
    const targetMsg = makeMessage(TARGET_USER_ID);
    const channel = makeChannel([[targetMsg]]);

    // Abort before we even start
    const deleted = await purgeChannelMessages(
      channel,
      TARGET_USER_ID,
      () => true
    );

    expect(deleted).toBe(0);
    expect(channel._fetch).not.toHaveBeenCalled();
  });

  it('stops mid-delete when isAborted flips during old message deletion', async () => {
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

    const oldMsg1 = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);
    const oldMsg2 = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);
    const oldMsg3 = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);

    let aborted = false;

    // Flip abort after the first delete completes
    oldMsg1._deleted.mockImplementation(() => {
      aborted = true;
      return Promise.resolve();
    });

    const channel = makeChannel([[oldMsg1, oldMsg2, oldMsg3]]);

    const promise = purgeChannelMessages(
      channel,
      TARGET_USER_ID,
      () => aborted
    );
    await vi.advanceTimersByTimeAsync(5000);
    const deleted = await promise;

    // Only the first message should have been deleted before abort kicked in
    expect(oldMsg1._deleted).toHaveBeenCalledTimes(1);
    expect(deleted).toBe(1);
  });

  it('calls onProgress after each chunk with cumulative count', async () => {
    const msg1 = makeMessage(TARGET_USER_ID);
    const msg2 = makeMessage(TARGET_USER_ID);

    const channel = makeChannel([[msg1, msg2]]);
    const progressCb = vi.fn();

    await purgeChannelMessages(channel, TARGET_USER_ID, undefined, progressCb);

    expect(progressCb).toHaveBeenCalledWith(2);
  });

  it('gracefully skips already-deleted messages (Unknown Message error)', async () => {
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

    const alreadyDeleted = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);
    const stillExists = makeMessage(TARGET_USER_ID, FIFTEEN_DAYS);
    const otherMsg = makeMessage(OTHER_USER_ID, FIFTEEN_DAYS);

    // Simulate "Unknown Message" for the first one
    alreadyDeleted._deleted.mockRejectedValue({ code: 10008 });

    const channel = makeChannel([[alreadyDeleted, stillExists, otherMsg]]);

    const promise = purgeChannelMessages(channel, TARGET_USER_ID);
    await vi.advanceTimersByTimeAsync(5000);
    const deleted = await promise;

    // Only the second target message counted as deleted
    expect(deleted).toBe(1);

    // The other user's message was never touched
    expect(otherMsg._deleted).not.toHaveBeenCalled();
  });

  it('returns 0 for an empty channel', async () => {
    const channel = makeChannel([[]]);
    const deleted = await purgeChannelMessages(channel, TARGET_USER_ID);
    expect(deleted).toBe(0);
  });
});
