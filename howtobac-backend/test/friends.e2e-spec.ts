import { FriendshipStatus } from '../src/generated/prisma/enums.js';
import {
  bearer,
  createTestApp,
  friendTools,
  type Person,
  type TestApp,
} from './helpers.js';

// Friend requests are limited to 10 per minute per IP, so rows that aren't
// under test are written straight to the database.
describe('Friends (e2e)', () => {
  let t: TestApp;
  let f: ReturnType<typeof friendTools>;
  const http = () => t.http();

  beforeAll(async () => {
    t = await createTestApp();
    f = friendTools(t);
  });

  afterAll(async () => {
    await t.close();
  });

  it('sends a request by friend code, lists it, and accepts it', async () => {
    const alice = await f.person('alice');
    const bob = await f.person('bob');

    // /me shows the code, and rotating replaces it.
    const me = await http()
      .get('/v1/me')
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(me.body.friendCode).toBe(alice.friendCode);
    const rotated = await http()
      .post('/v1/me/friend-code')
      .set(bearer(alice.accessToken))
      .expect(200);
    const code: string = rotated.body.friendCode;
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(code).not.toBe(alice.friendCode);

    const oldCode = await f.sendRequest(bob, alice.friendCode).expect(404);
    expect(oldCode.body.message).toBe('friend_code_not_found');

    // Typed the way people share it.
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
    const sent = await f.sendRequest(bob, typed).expect(201);
    expect(sent.body).toEqual({
      state: 'REQUEST_SENT',
      user: { id: alice.userId, userName: 'Test', role: 'USER' },
    });

    const incoming = await http()
      .get('/v1/friends/requests/incoming')
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(f.userIds(incoming)).toEqual([bob.userId]);
    const outgoing = await http()
      .get('/v1/friends/requests/outgoing')
      .set(bearer(bob.accessToken))
      .expect(200);
    expect(f.userIds(outgoing)).toEqual([alice.userId]);

    const again = await f.sendRequest(bob, code).expect(409);
    expect(again.body.message).toBe('request_already_sent');
    const self = await f.sendRequest(bob, bob.friendCode).expect(400);
    expect(self.body.message).toBe('cannot_friend_self');

    // Only the addressee can accept.
    await http()
      .post(`/v1/friends/requests/${alice.userId}/accept`)
      .set(bearer(bob.accessToken))
      .expect(404);
    const accepted = await http()
      .post(`/v1/friends/requests/${bob.userId}/accept`)
      .set(bearer(alice.accessToken))
      .expect(200);
    expect(accepted.body).toEqual({
      state: 'FRIENDS',
      user: { id: bob.userId, userName: 'Test', role: 'USER' },
    });
    await http()
      .post(`/v1/friends/requests/${bob.userId}/accept`)
      .set(bearer(alice.accessToken))
      .expect(404);

    const pairs: [Person, Person][] = [
      [alice, bob],
      [bob, alice],
    ];
    for (const [viewer, other] of pairs) {
      const friends = await http()
        .get('/v1/friends')
        .set(bearer(viewer.accessToken))
        .expect(200);
      expect(f.userIds(friends)).toEqual([other.userId]);
    }

    const alreadyFriends = await f.sendRequest(bob, code).expect(409);
    expect(alreadyFriends.body.message).toBe('already_friends');
  });

  it('asking back accepts, even when both ask at the same moment', async () => {
    const carol = await f.person('carol');
    const dan = await f.person('dan');
    await f.seedFriendship(carol, dan);

    const back = await f.sendRequest(dan, carol.friendCode).expect(200);
    expect(back.body.state).toBe('FRIENDS');
    const rows = await f.pairRows(carol, dan);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(FriendshipStatus.ACCEPTED);

    const erin = await f.person('erin');
    const frank = await f.person('frank');
    const results = await Promise.all([
      f.sendRequest(erin, frank.friendCode),
      f.sendRequest(frank, erin.friendCode),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);

    const raced = await f.pairRows(erin, frank);
    expect(raced).toHaveLength(1);
    expect(raced[0].status).toBe(FriendshipStatus.ACCEPTED);
  });

  it('declining, cancelling and unfriending delete the row', async () => {
    const gina = await f.person('gina');
    const hank = await f.person('hank');

    // hank declines gina's request
    await f.seedFriendship(gina, hank);
    await http()
      .delete(`/v1/friends/requests/${gina.userId}`)
      .set(bearer(hank.accessToken))
      .expect(204);
    expect(await f.pairRows(gina, hank)).toHaveLength(0);
    const nothingPending = await http()
      .delete(`/v1/friends/requests/${gina.userId}`)
      .set(bearer(hank.accessToken))
      .expect(404);
    expect(nothingPending.body.message).toBe('request_not_found');

    // gina cancels her own request
    await f.seedFriendship(gina, hank);
    await http()
      .delete(`/v1/friends/requests/${hank.userId}`)
      .set(bearer(gina.accessToken))
      .expect(204);
    expect(await f.pairRows(gina, hank)).toHaveLength(0);

    // Friends are removed with DELETE /friends/:id, not as a request.
    await f.seedFriendship(gina, hank, FriendshipStatus.ACCEPTED);
    await http()
      .delete(`/v1/friends/requests/${gina.userId}`)
      .set(bearer(hank.accessToken))
      .expect(404);
    await http()
      .delete(`/v1/friends/${gina.userId}`)
      .set(bearer(hank.accessToken))
      .expect(204);
    for (const person of [gina, hank]) {
      const friends = await http()
        .get('/v1/friends')
        .set(bearer(person.accessToken))
        .expect(200);
      expect(f.userIds(friends)).toEqual([]);
    }
    const notFriends = await http()
      .delete(`/v1/friends/${gina.userId}`)
      .set(bearer(hank.accessToken))
      .expect(404);
    expect(notFriends.body.message).toBe('not_friends');
  });
});
