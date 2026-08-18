FROM jenkins/jenkins:lts-jdk17

USER root

# Lấy sẵn Docker CLI từ image chính thức để Jenkins có thể chạy lệnh "docker build".
# Container này KHÔNG chạy Docker daemon riêng — nó dùng chung daemon của máy thật
# thông qua docker.sock được mount ở docker-compose.yml.
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker

USER jenkins
