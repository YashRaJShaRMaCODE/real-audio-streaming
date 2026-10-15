FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre
COPY --from=build /app/target/*.jar /app.jar
ENV JAVA_TOOL_OPTIONS="-Xmx300m"
CMD ["java", "-jar", "/app.jar"]
