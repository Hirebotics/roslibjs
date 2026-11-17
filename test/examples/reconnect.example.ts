import { describe, it, expect, afterAll, vi } from "vitest";
import * as ROSLIB from "../../src/RosLib.js";

describe("Topic reconnect", function () {
  const url = "ws://localhost:9090";
  const subscriberRos = new ROSLIB.Ros({ url });
  const publisherRos = new ROSLIB.Ros({ url });

  const subscriber = subscriberRos.Topic<{ data: string }>({
    name: "/reconnect_topic",
    messageType: "std_msgs/String",
  });
  const publisher = publisherRos.Topic<{ data: string }>({
    name: "/reconnect_topic",
    messageType: "std_msgs/String",
  });

  async function dropAndReconnect() {
    const closed = new Promise((resolve) =>
      subscriberRos.once("close", resolve),
    );
    subscriberRos.close();
    await closed;
    await subscriberRos.connect(url);
    await vi.waitFor(() => {
      expect(subscriberRos.isConnected()).toBe(true);
    });
  }

  // Guards against Topic resubscribing only after the first drop.
  it("keeps receiving messages after the connection drops twice", async () => {
    const callback = vi.fn();
    subscriber.subscribe(callback);

    // Re-publish until delivered, since the subscribe op may not have reached rosbridge yet.
    const expectDelivery = async (data: string) => {
      await vi.waitFor(
        () => {
          publisher.publish({ data });
          expect(callback).toHaveBeenCalledWith({ data });
        },
        { timeout: 5000, interval: 100 },
      );
    };

    await expectDelivery("before drop");

    await dropAndReconnect();
    await expectDelivery("after drop 1");

    await dropAndReconnect();
    await expectDelivery("after drop 2");
  }, 20000);

  afterAll(function () {
    subscriber.unsubscribe();
    publisher.unadvertise();
    subscriberRos.close();
    publisherRos.close();
  });
});
