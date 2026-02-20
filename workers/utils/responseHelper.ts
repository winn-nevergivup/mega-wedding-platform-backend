// workers/lib/responseHelper.ts
export const sendResponse = {
    success: (data: any, status = 201) => {
        if (data.message) {
            return new Response(JSON.stringify({ success: true, message: data.message, ...data }), {
                status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: true, data }), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    },

    error: (message: string, status = 400, details?: any) => {
        return new Response(JSON.stringify({ success: false, error: message, details }), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    },
}


//build response
function buildResponse(
    data: any,
    debug: any,
    IS_DEV: boolean
) {
    return new Response(
        JSON.stringify({
            success: true,
            data,
            debug: IS_DEV ? debug : undefined,
        }),
        { status: 200 }
    );
}

//build error
function buildError(message: string, status = 400) {
    return new Response(
        JSON.stringify({
            success: false,
            message,
        }),
        { status }
    );
}
