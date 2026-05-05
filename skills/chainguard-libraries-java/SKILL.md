---
name: chainguard-libraries-java
description: Configure a Java/Maven or Gradle project to use Chainguard Libraries for hardened Java dependencies. Use when the user wants to set up Chainguard Libraries for Maven or Gradle, or asks about hardened Java packages.
---

# Chainguard Libraries for Java

Chainguard Libraries provides hardened Maven artifacts with reduced CVE exposure. Artifacts are distributed via a private Maven repository that requires an auth token.

## Step 1: Generate a Libraries Token

```bash
chainctl libraries token java
```

Copy the token — you will use it as a Maven repository password.

## Step 2: Configure Maven (`~/.m2/settings.xml`)

Add the Chainguard repository and credentials:

```xml
<settings>
  <servers>
    <server>
      <id>chainguard-libraries</id>
      <username>user</username>
      <!-- Use an environment variable to avoid committing the token -->
      <password>${env.CHAINGUARD_LIBRARIES_JAVA_TOKEN}</password>
    </server>
  </servers>

  <profiles>
    <profile>
      <id>chainguard</id>
      <repositories>
        <repository>
          <id>chainguard-libraries</id>
          <url>https://libraries.cgr.dev/java/</url>
          <releases><enabled>true</enabled></releases>
          <snapshots><enabled>false</enabled></snapshots>
        </repository>
      </repositories>
    </profile>
  </profiles>

  <activeProfiles>
    <activeProfile>chainguard</activeProfile>
  </activeProfiles>
</settings>
```

Export your token:

```bash
export CHAINGUARD_LIBRARIES_JAVA_TOKEN=$(chainctl libraries token java)
```

## Step 3: Configure Gradle (`build.gradle` or `build.gradle.kts`)

```kotlin
// build.gradle.kts
repositories {
    maven {
        url = uri("https://libraries.cgr.dev/java/")
        credentials {
            username = "user"
            password = System.getenv("CHAINGUARD_LIBRARIES_JAVA_TOKEN")
        }
    }
    mavenCentral() // fallback for packages not yet in Chainguard Libraries
}
```

## Step 4: Verify

Run a dependency resolution to confirm the repository is reachable:

```bash
# Maven
mvn dependency:resolve -U

# Gradle
./gradlew dependencies
```

## Notes

- Chainguard Libraries mirrors popular Maven Central artifacts with patched transitive dependencies. Use the same `groupId:artifactId:version` coordinates — no changes to dependency declarations needed.
- If a package is not yet available in Chainguard Libraries, Maven/Gradle will fall through to the Central fallback repository.
- Token refresh: run `chainctl libraries token java` to get a fresh token when the current one expires.
- Do not commit tokens. Store `CHAINGUARD_LIBRARIES_JAVA_TOKEN` in CI secrets or a secrets manager.
