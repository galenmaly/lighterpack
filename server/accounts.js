import config from 'config';
import cloneDeep from 'lodash/cloneDeep.js';
import Knex from 'knex';
import { deleteUserImages } from './images.js';

const knex = Knex({
    client: 'pg',
    connection: cloneDeep(config.get('pgDatabase'))
});

/**
 * Erase one account: its share links, its row, and its uploaded images.
 *
 * Shared by the user-facing /delete-account endpoint and the operator script,
 * so a deletion done on someone's behalf is the same deletion they would have
 * performed themselves -- including the parts that are easy to forget by hand,
 * like the FK ordering and the image directory, whose name is a hash of the
 * user_id rather than anything you could spot in the filesystem.
 *
 * Returns { removedImages, imageError }. Image cleanup is best effort and
 * reported rather than thrown: the account is already gone by then, and files
 * left behind are recoverable in a way that failing the caller is not.
 */
async function deleteUserAccount(user) {
    // list rows FK-reference the user, so they must go first (same transaction)
    await knex.transaction(async (trx) => {
        await trx('list').where({ user_id: user.user_id }).del();
        await trx('users').where({ user_id: user.user_id }).del();
    });

    // After the commit, so a rolled-back delete never destroys photos.
    try {
        return { removedImages: deleteUserImages(user.user_id) };
    } catch (err) {
        return { removedImages: 0, imageError: err };
    }
}

/**
 * Release the connection pool. The server never calls this -- it is here so a
 * one-shot script can exit instead of hanging on an idle pool.
 */
async function closeAccountsDb() {
    await knex.destroy();
}

export { deleteUserAccount, closeAccountsDb };
