import { GetStaticProps, InferGetStaticPropsType } from "next";
import { createSwaggerSpec } from "next-swagger-doc";
import packageJson from "../package.json" assert { type: "json" };
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
  faUpRightFromSquare,
  faUserAstronaut,
} from "@fortawesome/free-solid-svg-icons";

function ApiDoc({
  spec,
  packageJson,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      <div className="swagger-ui">
        <div className="information-container wrapper">
          <section className="block col-12">
            <div>
              <div className="info">
                <div className="description">
                  {packageJson?.homepage ? (
                    <p>
                      <a href={packageJson?.homepage}>
                        <FontAwesomeIcon icon={faUpRightFromSquare} />{" "}
                        {packageJson?.homepage}
                      </a>
                    </p>
                  ) : null}
                  {packageJson?.repository?.url ? (
                    <p>
                      <a href={packageJson?.repository?.url}>
                        <FontAwesomeIcon icon={faGithub} />{" "}
                        {packageJson?.repository?.url}
                      </a>
                    </p>
                  ) : null}
                  {packageJson?.author ? (
                    <p>
                      <a href={`mailto:${packageJson?.author?.email}`}>
                        <FontAwesomeIcon icon={faUserAstronaut} />{" "}
                        {packageJson?.author?.name} {packageJson?.author?.email}
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <SwaggerUI spec={spec} />
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const spec: Record<string, any> = createSwaggerSpec({
    apiVersion: "1.0",
    definition: {
      openapi: "3.0.0",
      info: {
        title: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        // contact: {
        //   name: packageJson.author.name,
        //   email: packageJson.author.email,
        // },
      },
    },
    externalDocs: {
      description: "Find out more",
      url: packageJson.homepage,
    },
  });
  return {
    props: {
      spec,
      packageJson,
    },
  };
};

export default ApiDoc;
