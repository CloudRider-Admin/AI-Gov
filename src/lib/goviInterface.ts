/** Valid Govi interface skins. Keep in sync with `goviInterface` on the User model. */
export const GOVI_INTERFACES = ['terminal', 'sovereign'] as const;
export type GoviInterface = (typeof GOVI_INTERFACES)[number];
