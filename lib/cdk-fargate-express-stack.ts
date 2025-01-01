import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as logs from "aws-cdk-lib/aws-logs";

import "dotenv/config";

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkFargateExpressStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkFargateExpressQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    const vpc = new ec2.Vpc(this, "vpc", {
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr("10.0.0.0/16"),
      natGateways: 0,
      maxAzs: 2,
    });

    const ecsSg = new ec2.SecurityGroup(this, "ecs-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });
    ecsSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      "allow http from anywhere"
    );

    //create repository
    const repository = new ecr.Repository(this, "repository", {
      repositoryName: "cdk-express",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "repositoryURI", {
      value: repository.repositoryUri,
    });

    // タスク実行ロール
    const executionRole = new iam.Role(this, "executionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    executionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    // log
    const logGroup = new logs.LogGroup(this, "logGroup", {
      logGroupName: "/ecs/express",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    if (true) {
      const cluster = new ecs.Cluster(this, "cluster", {
        vpc: vpc,
        clusterName: "ecs-fargate-cluster-express",
        containerInsights: false,
        enableFargateCapacityProviders: true,
      });

      const taskDef = new ecs.FargateTaskDefinition(this, "taskDef", {
        cpu: 256,
        memoryLimitMiB: 512,
        executionRole,
      });
      taskDef.addContainer("container", {
        image: ecs.ContainerImage.fromRegistry(process.env.ECR_REPO_URI || ""),
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: "ecs",
          logGroup,
        }),
      });

      new ecs.FargateService(this, "service", {
        cluster: cluster,
        taskDefinition: taskDef,
        desiredCount: 1,
        securityGroups: [ecsSg],
        assignPublicIp: true,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      });
    }
  }
}
