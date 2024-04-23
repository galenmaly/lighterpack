from locust import HttpUser, task
import random

sampleIds = []

class HelloWorldUser(HttpUser):

    def on_start(self):
        """ on_start is called when a Locust start before any task is scheduled """
        self.client.verify = False


    @task
    def hello_world(self):
        self.client.get("/r/"+ random.choice(sampleIds))
