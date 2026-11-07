package com.prepxl.audiostreaming;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
class AudioStreamingApplicationTests {
	@Autowired
	private WebTestClient webTestClient;

	@Test
	void contextLoads() {
	}

	@Test
	void healthEndpointReturnsOk() {
		webTestClient.get().uri("/health")
				.exchange()
				.expectStatus().isOk()
				.expectBody().json("{\"status\":\"ok\"}");
	}

}
