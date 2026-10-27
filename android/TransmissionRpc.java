package top.rootu.lampa.net;

import java.io.IOException;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/** Retries the Transmission CSRF handshake once, before the JS bridge drops headers. */
public final class TransmissionRpc {
    private TransmissionRpc() {}

    public static Response execute(OkHttpClient client, Request request) throws IOException {
        Response response = client.newCall(request).execute();
        String path = request.url().encodedPath();
        String session = response.header("X-Transmission-Session-Id");
        boolean isRpc = "/transmission/rpc".equals(path) || "/transmission/rpc/".equals(path);
        boolean sameUrl = request.url().equals(response.request().url());
        if (!isRpc || !sameUrl || response.code() != 409 || session == null || session.isEmpty()) {
            return response;
        }
        Request retry = request.newBuilder().header("X-Transmission-Session-Id", session).build();
        response.close();
        return client.newCall(retry).execute();
    }
}
