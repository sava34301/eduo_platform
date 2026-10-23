import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('school_records', {
 owner: text('owner').notNull(), id: text('id').notNull(), kind: text('kind').notNull(),
 payload: text('payload').notNull(), updatedAt: text('updated_at').notNull(),
}, t=>[primaryKey({columns:[t.owner,t.id]}),index('idx_school_records_owner_kind').on(t.owner,t.kind)]);
