#!/bin/bash

vpc_id="vpc-0617c6701cc872531" #${vpc_id}

sub1_id="subnet-0076d7b08595ddf6d" #${sub1_id}
sub2_id="subnet-0c23b85db54dbcca0" #${sub2_id}

igw_id="igw-0103812205b5be7e5" #${igw_id}
rtb_id="rtb-0c3cace747a39847e" #${rtb_id}

ecs_arn="arn:aws:ecs:us-east-1:205610973265:cluster/fantasy-football-cluster"

sg_id="sg-0664bd5959ddaf8c8" #${sg_id}
alb_sg_id="sg-061996c8b08d4f9af" #${alb_sg_id}

alb_arn_id="arn:aws:elasticloadbalancing:us-east-1:205610973265:loadbalancer/app/fantasy-football-alb/c6d26f16f2f4c423" #${alb_arn_id}
tg_arn="arn:aws:elasticloadbalancing:us-east-1:205610973265:targetgroup/fantasy-football-tg/74d7efc1323992d5" #${tg_arn}

# --no-cli-pager

aws ecs describe-tasks \
    --cluster fantasy-football-cluster \
    --tasks arn:aws:ecs:us-east-1:205610973265:task/fantasy-football-cluster/e5cfef598933481a895c563e6ef0bc15 \
    --no-cli-pager