import { FriendshipStatus } from '../src/generated/prisma/enums.js';
import {
  bearer,
  createTestApp,
  friendTools,
  type Person,
  type TestApp,
} from './helpers.js';

const UNKNOWN_USER = '00000000-0000-7000-8000-000000000000';

// A separate app from friends.e2e-spec.ts, so it has its own request budget.
describe('Blocks and relationship state (e2e)', () => {
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

  it('blocking ends the friendship and hides you from their requests', async () => {
    const ivy = await f.person('ivy');
    const jack = await f.person('jack');
    await f.seedFriendship(ivy, jack, FriendshipStatus.ACCEPTED);

    await http()
      .put(`/v1/blocks/${jack.userId}`)
      .set(bearer(ivy.accessToken))
      .expect(204);
    await http()
      .put(`/v1/blocks/${jack.userId}`)
      .set(bearer(ivy.accessToken))
      .expect(204);
    expect(await f.pairRows(ivy, jack)).toHaveLength(0);

    // Jack can't tell he's blocked: the code just looks wrong.
    const hidden = await f.sendRequest(jack, ivy.tag).expect(404);
    expect(hidden.body.message).toBe('tag_not_found');
    const own = await f.sendRequest(ivy, jack.tag).expect(409);
    expect(own.body.message).toBe('user_blocked');

    const blocks = await http()
      .get('/v1/blocks')
      .set(bearer(ivy.accessToken))
      .expect(200);
    expect(f.userIds(blocks)).toEqual([jack.userId]);

    const self = await http()
      .put(`/v1/blocks/${ivy.userId}`)
      .set(bearer(ivy.accessToken))
      .expect(400);
    expect(self.body.message).toBe('cannot_block_self');
    await http()
      .put(`/v1/blocks/${UNKNOWN_USER}`)
      .set(bearer(ivy.accessToken))
      .expect(404);

    await http()
      .delete(`/v1/blocks/${jack.userId}`)
      .set(bearer(ivy.accessToken))
      .expect(204);
    await http()
      .delete(`/v1/blocks/${jack.userId}`)
      .set(bearer(ivy.accessToken))
      .expect(204);
    await f.sendRequest(jack, ivy.tag).expect(201);
  });

  it('reports the relationship from each side', async () => {
    const kim = await f.person('kim');
    const leo = await f.person('leo');
    const stateOf = async (viewer: Person, other: Person) =>
      (
        await http()
          .get(`/v1/friends/status/${other.userId}`)
          .set(bearer(viewer.accessToken))
          .expect(200)
      ).body.state;

    expect(await stateOf(kim, leo)).toBe('NONE');

    await f.sendRequest(kim, leo.tag).expect(201);
    expect(await stateOf(kim, leo)).toBe('REQUEST_SENT');
    expect(await stateOf(leo, kim)).toBe('REQUEST_RECEIVED');

    await http()
      .post(`/v1/friends/requests/${kim.userId}/accept`)
      .set(bearer(leo.accessToken))
      .expect(200);
    expect(await stateOf(kim, leo)).toBe('FRIENDS');
    expect(await stateOf(leo, kim)).toBe('FRIENDS');

    await http()
      .delete(`/v1/friends/${leo.userId}`)
      .set(bearer(kim.accessToken))
      .expect(204);
    expect(await stateOf(kim, leo)).toBe('NONE');

    await http()
      .put(`/v1/blocks/${leo.userId}`)
      .set(bearer(kim.accessToken))
      .expect(204);
    expect(await stateOf(kim, leo)).toBe('BLOCKED');
    // Being blocked isn't revealed.
    expect(await stateOf(leo, kim)).toBe('NONE');

    await http()
      .get(`/v1/friends/status/${UNKNOWN_USER}`)
      .set(bearer(kim.accessToken))
      .expect(404);
    await http()
      .get(`/v1/friends/status/${kim.userId}`)
      .set(bearer(kim.accessToken))
      .expect(400);
  });
});
