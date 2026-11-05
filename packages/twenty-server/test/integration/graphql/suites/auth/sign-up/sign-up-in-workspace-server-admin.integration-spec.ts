import { signUpInWorkspaceAndGetAccessToken } from 'test/integration/graphql/utils/sign-up-in-workspace-and-get-access-token.util';
import { getAppProviderByClassName } from 'test/integration/utils/get-app-provider-by-class-name.util';
import { getCoreRepository } from 'test/integration/utils/get-core-repository.util';
import { In } from 'typeorm';

import { type CoreEntityCacheService } from 'src/engine/core-entity-cache/services/core-entity-cache.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

describe('signUpInWorkspace server admin flags (integration)', () => {
  const runId = Date.now();
  const createdEmails: string[] = [];
  let serverAdminIds: string[] = [];

  const setServerAdminsFlag = async (canAccessFullAdminPanel: boolean) => {
    await getCoreRepository<UserEntity>(UserEntity).update(
      { id: In(serverAdminIds) },
      { canAccessFullAdminPanel },
    );

    const coreEntityCacheService =
      getAppProviderByClassName<CoreEntityCacheService>(
        'CoreEntityCacheService',
      );

    await Promise.all(
      serverAdminIds.map((id) => coreEntityCacheService.invalidate('user', id)),
    );
  };

  const signUpNewUserInWorkspace = async (label: string) => {
    const email = `${label}-${runId}@example.com`;

    createdEmails.push(email);

    await signUpInWorkspaceAndGetAccessToken(email);

    return getCoreRepository<UserEntity>(UserEntity).findOneOrFail({
      where: { email },
      select: { canAccessFullAdminPanel: true, canImpersonate: true },
    });
  };

  beforeAll(async () => {
    const serverAdmins = await getCoreRepository<UserEntity>(UserEntity).find({
      where: { canAccessFullAdminPanel: true },
      select: { id: true },
    });

    serverAdminIds = serverAdmins.map(({ id }) => id);
  });

  afterAll(async () => {
    await setServerAdminsFlag(true);

    await getCoreRepository<UserEntity>(UserEntity).delete({
      email: In(createdEmails),
    });
  });

  it('grants server admin to a new user joining a workspace when the instance has no server admin left', async () => {
    await setServerAdminsFlag(false);

    const user = await signUpNewUserInWorkspace('no-server-admin-left');

    expect(user.canAccessFullAdminPanel).toBe(true);
    expect(user.canImpersonate).toBe(true);
  });

  it('does not grant server admin to a new user joining a workspace when a server admin exists', async () => {
    await setServerAdminsFlag(true);

    const user = await signUpNewUserInWorkspace('server-admin-exists');

    expect(user.canAccessFullAdminPanel).toBe(false);
    expect(user.canImpersonate).toBe(false);
  });
});
