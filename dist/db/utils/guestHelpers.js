export function createGuest(data) {
    return {
        id: crypto.randomUUID(),
        publicHash: crypto.randomUUID(),
        // set default boolean / number
        isSent: false,
        checkinStatus: false,
        totalBringPeople: 0,
        ...data,
    };
}
