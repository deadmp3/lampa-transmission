package top.rootu.lampa.net;

import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

public class TransmissionRpcTest {
    private MockWebServer server;
    private OkHttpClient client;

    @Before public void setup() throws Exception {
        server = new MockWebServer();
        server.start();
        client = new OkHttpClient.Builder().readTimeout(2, TimeUnit.SECONDS).build();
    }
    @After public void teardown() throws Exception { server.shutdown(); }
    private Request request(String path) {
        return new Request.Builder().url(server.url(path))
            .header("Authorization", "Basic test-value")
            .post(RequestBody.create(MediaType.parse("application/json"), "{\"method\":\"session-get\"}"))
            .build();
    }
    @Test public void repeatsBodyAndPreservesHeadersWithFreshSession() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(409).addHeader("X-Transmission-Session-Id", "new-session"));
        server.enqueue(new MockResponse().setBody("{\"result\":\"success\"}"));
        try (Response response = TransmissionRpc.execute(client, request("/transmission/rpc"))) {
            assertEquals(200, response.code());
        }
        RecordedRequest first = server.takeRequest();
        RecordedRequest second = server.takeRequest();
        assertEquals("POST", second.getMethod());
        assertEquals(first.getBody().readUtf8(), second.getBody().readUtf8());
        assertEquals("Basic test-value", second.getHeader("Authorization"));
        assertEquals("new-session", second.getHeader("X-Transmission-Session-Id"));
    }
    @Test public void neverLoopsOnRepeatedConflict() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(409).addHeader("X-Transmission-Session-Id", "one"));
        server.enqueue(new MockResponse().setResponseCode(409).addHeader("X-Transmission-Session-Id", "two"));
        try (Response response = TransmissionRpc.execute(client, request("/transmission/rpc/"))) {
            assertEquals(409, response.code());
        }
        assertEquals(2, server.getRequestCount());
    }
    @Test public void authenticationFailuresAreNotRetried() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(401).addHeader("X-Transmission-Session-Id", "one"));
        try (Response response = TransmissionRpc.execute(client, request("/transmission/rpc"))) {
            assertEquals(401, response.code());
        }
        assertEquals(1, server.getRequestCount());
    }
    @Test public void unrelatedConflictsAreNotRetried() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(409).addHeader("X-Transmission-Session-Id", "one"));
        try (Response response = TransmissionRpc.execute(client, request("/other/api"))) {
            assertEquals(409, response.code());
        }
        assertEquals(1, server.getRequestCount());
    }
    @Test public void missingSessionIsNotRetried() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(409));
        try (Response response = TransmissionRpc.execute(client, request("/transmission/rpc"))) {
            assertEquals(409, response.code());
        }
        assertEquals(1, server.getRequestCount());
    }
    @Test public void redirectedSessionIsNotSentToOriginalEndpoint() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(302).addHeader("Location", "/other/api"));
        server.enqueue(new MockResponse().setResponseCode(409).addHeader("X-Transmission-Session-Id", "one"));
        try (Response response = TransmissionRpc.execute(client, request("/transmission/rpc"))) {
            assertEquals(409, response.code());
        }
        assertEquals(2, server.getRequestCount());
    }
}
