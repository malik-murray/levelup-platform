import { createRandomId } from '@/lib/createRandomId';

describe('createRandomId', () => {
    it('returns a uuid-shaped string', () => {
        const id = createRandomId();
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });
});
