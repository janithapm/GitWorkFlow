module.exports = function ({ config, gloveMetricCollection, metricCommons, lodash, moment, userLogics, metricUserLogics }) {
    var _ = lodash;
    var metricMetaData = config.getMapConfig().designDocs.metricscollection.GET_METRICS_BY_TIME_GROUPBY_DAY.metaData;
    var supervisorMetricsMetaData = config.getMapConfig().designDocs.metricscollection.GET_METRICS_BY_USER_GROUPBY_EMPLOYEE.metaData;

    function aggregateMetricsByGroup(data, groupByFactor) {
        var finalMetricData = [];
        var dataGroupedByType = GroupResultsetByType(data, groupByFactor);
        Object.keys(dataGroupedByType).forEach(function (key) {
            var tempArr = [];
            var nonKeyPropery = dataGroupedByType[key][0].name;
            dataGroupedByType[key].forEach(element => {
                tempArr.push(element.metrics);
            })
            finalMetricData.push(aggregateMetrics(key, nonKeyPropery, tempArr));
        });

        return finalMetricData;

    }

    function aggregateMetrics(key, nonKeyPropery, data) {
        var metricObj = {
            id: key,
            name: nonKeyPropery,
            metrics: {}
        }
        var result = _.map(_.unzip(data), _.sum);
        for (let i = 0; i < supervisorMetricsMetaData.length; i++) {
            metricObj.metrics[supervisorMetricsMetaData[i]] = result[i];
        }
        return metricObj;
    }

    function GroupResultsetByType(data, groupByFactor) {
        var groupedByResult = _.groupBy(data, groupByFactor);
        return groupedByResult;
    }

    return {
        getTeamMetrics: function (teamIds, orgId, uid, queryFilters) {

            // var orgId ="346b56f9240695aa8c949591c4cfe0dc";
            // var userId="37f7e74bb9140a375383f8e11a2013e8";
            var type = null;
            return gloveMetricCollection.getMetricsByUser(orgId, uid, queryFilters.startDate, queryFilters.endDate, type);
        },
        getTeamMetricByTime: function (orgId, uid, type, queryFilters) {

            // var orgId ="346b56f9240695aa8c949591c4cfe0dc";
            // var userId="37f7e74bb9140a375383f8e11a2013e8";
            //var type = "daily";
            return gloveMetricCollection.getMetricsByTime(orgId, uid, queryFilters.startDate, queryFilters.endDate, type)
                .then(result => {

                    var dateRange = [];

                    var emptyMets = {};

                    metricMetaData.forEach(metName => {
                        emptyMets[metName] = 0;
                    });

                    let inc = ""; //incremental factor for moment array
                    let dateFormat = "" //format for zero elements
                    switch (type) {
                        case "daily":
                            inc = "days";
                            dateFormat = "YYYY-MM-DD";
                            break;
                        case "monthly":
                            inc = "months";
                            dateFormat = "YYYY-MM";
                            break;
                        case "hourly":
                            inc = "hours";
                            dateFormat = "YYYY-MM-DD-HH";
                            break;
                        default:
                            dateFormat = "YYYY-MM-DD";
                            inc = "days";
                    }


                    //generate zero values for empty slots
                    for (let d = moment(queryFilters.startDate); d.isBefore(queryFilters.endDate); d.add(1, inc)) {
                        dateRange.push(
                            {
                                name: moment(d).format(dateFormat).toString(),
                                id: null,
                                metrics: emptyMets
                            });
                    }
                    var emptySlots = _.differenceBy(dateRange, result, 'name');
                    //list.sort((a, b) => (a.color > b.color) ? 1 : -1)
                    var resultObject = {
                        data: result.concat(emptySlots).sort((a, b) => (a.name > b.name) ? 1 : -1)
                    }
                    return resultObject;

                })
        },


        getTeamMetricSubTotal: function (orgId, uid, queryFilters, type) {
            console.log('calling')
            // var orgId ="346b56f9240695aa8c949591c4cfe0dc";
            // var userId="37f7e74bb9140a375383f8e11a2013e8";
            //var type = "daily";
            var designDoc = config.getMapConfig().designDocs.metricscollection;
            var metaData = designDoc.GET_METRICS_BY_USER_GROUPBY_EMPLOYEE.metaData;
            var userMetricData = {
                id: null,
                name: null,
                metrics: {}
            }

            return gloveMetricCollection.getMetricsByTime(orgId, uid, queryFilters.startDate, queryFilters.endDate, type)
                .then(result => {
                    console.log('notFound...>', result.length)
                    if (result.length === 0) {
                        for (let i = 0; i < metaData.length; i++) {
                            userMetricData.metrics[metaData[i]] = 0;
                        }
                        var finalResultEmpty = { data: [userMetricData] }
                        return finalResultEmpty;

                    } else {
                        var finalResult = { data: result }
                        return finalResult;
                    }

                })
        },

        /**
            * Returns the supervisor metrics json array for team category
        */
        getSupervisorMetricsByTeam: function (orgId, teams, type, queryFilters, isOrgAdmin, filterOptions) {

            var teamToUserMap = [];
            var teamMembers = [];

            if (filterOptions) {
                for (var key in filterOptions) {
                    if (filterOptions[key].length === 0) {
                        delete filterOptions[key];
                    }
                }
            }

            teams.map(team => {
                team.users.map(userId => {
                    teamMembers.push(userId);
                    teamToUserMap[userId] = team;
                })
            });

            if (isOrgAdmin) {

                return userLogics.getAllUsersInOrg(orgId)
                    .then(result => {
                        var allUsers = result.map(user => user._id.toHexString());
                        var notAssignedUsers = _.difference(allUsers, teamMembers);

                        notAssignedUsers.forEach(user => {
                            teamToUserMap[user] = { _id: user, name: 'Not Assigned', teamId: 'not_assigned' }
                        });

                        if (_.isEmpty(filterOptions) || filterOptions == undefined) {
                            var users = [];
                            allUsers.map(user => {
                                users.push({ _id: user, teamName: teamToUserMap[user].name, teamId: teamToUserMap[user].teamId });
                            })
                            return getSupervisorMetricsByUsers(orgId, queryFilterqueryFilters, users, type)

                        } else {
                            filterOptions['_id'] = resolveUsersAndTeams(teams, filterOptions, allUsers, notAssignedUsers);
                            return userLogics.getUsersByProperties(filterOptions)
                                .then(result => {
                                    result.map(user => {
                                        user.teamName = teamToUserMap[user._id].name;
                                        user.teamId = teamToUserMap[user._id].teamId;
                                    })
                                    return getSupervisorMetricsByUsers(orgId, queryFilters, result, type)
                                })
                        }

                    })

            }
            else {

                if (_.isEmpty(filterOptions) || filterOptions == undefined) {
                    var users = [];
                    teams.map(team => {
                        team.users.map(userId => {
                            users.push({ _id: userId, teamId: team.teamId, teamName: team.name })
                        })
                    });
                    return getSupervisorMetricsByUsers(orgId, queryFilters, users, type)

                }
                else {
                    filterOptions['_id'] = resolveUsersAndTeams(teams, filterOptions, teamMembers);

                    return userLogics.getUsersByProperties(filterOptions)
                        .then(result => {
                            result.map(user => {
                                user.teamName = teamToUserMap[user._id].name;
                                user.teamId = teamToUserMap[user._id].teamId;
                            })
                            return getSupervisorMetricsByUsers(orgId, queryFilters, result, type)
                        })
                }
            }

        },

        /**
            * Returns the supervisor metrics json array for employee, location and jobfunction categories
        */
        getSupervisorMetricsByCategory: function (orgId, teams, type, queryFilters, isOrgAdmin, filterOptions) {
            var teamMembers = [];
            if (filterOptions) {
                for (var key in filterOptions) {
                    if (filterOptions[key].length === 0) {
                        delete filterOptions[key];
                    }
                }
            }

            teams.map(team => {
                team.users.map(userId => {
                    teamMembers.push(userId);
                })
            });
            // if the person has org admin perms
            if (isOrgAdmin) {
                return userLogics.getAllUsersInOrg(orgId)
                    .then(result => {
                        var allUsers = result.map(user => user._id.toHexString());
                        var notAssignedUsers = _.difference(allUsers, teamMembers);

                        if (_.isEmpty(filterOptions) || filterOptions == undefined) {
                            return getSupervisorMetricsByUsers(orgId, queryFilters, result, type)

                        } else {
                            filterOptions['_id'] = resolveUsersAndTeams(teams, filterOptions, allUsers, notAssignedUsers);

                            return userLogics.getUsersByProperties(filterOptions)
                                .then(result => {
                                    return getSupervisorMetricsByUsers(orgId, queryFilters, result, type)
                                })
                        }
                    })

            } else {
                //If the person has supervisor perms only
                if (_.isEmpty(filterOptions) || filterOptions == undefined) {
                    return userLogics.getUsersByIds(teamMembers, false)
                        .then(result => getSupervisorMetricsByUsers(orgId, queryFilters, result, type));
                }
                else {
                    filterOptions['_id'] = resolveUsersAndTeams(teams, filterOptions, teamMembers);

                    return userLogics.getUsersByProperties(filterOptions)
                        .then(result => {
                            return getSupervisorMetricsByUsers(orgId, queryFilters, result, type)
                        })
                }
            }

        }
    }

    /**
        * Returns the final list of userIds based on team and employee filters
    */
    function resolveUsersAndTeams(teams, filterOptions, allUsers, notAssignedUsers) {
        var userIds = [];
        if ("teamId" in filterOptions) {
            var selectedTeams = teams.filter(team => filterOptions.teamId.includes(team.teamId));
            if (filterOptions.teamId.includes('not_assigned')) {
                selectedTeams.push({ users: notAssignedUsers })
            }
            var selectedUsers = _.flatten(selectedTeams.map(team => team.users));
            delete filterOptions['teamId'];

            if ("employeeId" in filterOptions) {
                userIds = _.intersection(filterOptions.employeeId, selectedUsers);
                delete filterOptions['employeeId'];
            } else if (!("employeeId" in filterOptions)) {
                userIds = [].concat(...selectedUsers);
            }

        } else if (!("teamId" in filterOptions) && "employeeId" in filterOptions) {
            userIds = filterOptions.employeeId;
            delete filterOptions['employeeId'];
        } else if (!("teamId" in filterOptions) && !("employeeId" in filterOptions)) {
            userIds = allUsers;
        }
        return userIds;
    };


    /**
        * Get user by user metric data for each user and returns an object of metrics by category(employee/location/jobfunction)
    */
    function getSupervisorMetricsByUsers(orgId, queryFilters, users, type) {
        var promiseArray = [];
        if (type == 'location') {
            users.forEach(user => {
                if (user.locationId) {
                    promiseArray.push(gloveMetricCollection.getSupervisorMetricsByUser(orgId, user, queryFilters.startDate, queryFilters.endDate, type))
                }
            });
        } else if (type == 'jobfunction') {
            users.forEach(user => {
                if (user.jobFunctionId) {
                    promiseArray.push(gloveMetricCollection.getSupervisorMetricsByUser(orgId, user, queryFilters.startDate, queryFilters.endDate, type))
                }
            });
        } else {
            users.forEach(user => {
                promiseArray.push(gloveMetricCollection.getSupervisorMetricsByUser(orgId, user, queryFilters.startDate, queryFilters.endDate, type))
            });
        }
        return Promise.all(promiseArray)
            .then(result => {
                if (type == 'employee') {
                    var metricsObject = {
                        data: result
                    }
                } else {
                    var aggregatedMetData = aggregateMetricsByGroup(result, 'id')
                    var metricsObject = {
                        data: aggregatedMetData
                    }
                }
                return metricsObject;
            }).catch(err => {
                var err = new Error('E005');
                err.code = 'E004';
                return err;
            })
    };


    /**
        * Get metrics for all users
    */
    function getMetricsOnType(userId, teams, type, queryFilters, filterOptions) {
        const resolvedUsers = getUsers(userId, teams, type, queryFilters, filterOptions);
        let promiseArray = [];

        switch (type) {
            case "location":
                resolvedUsers.forEach(user => {
                    if (user.locationId) {
                        promiseArray.push(gloveMetricCollection.getSupervisorMetricsByUser(orgId, user, queryFilters.startDate, queryFilters.endDate, type))
                    }
                });
                break;
            case "team":
                /** */
                return gloveMetricLogics.getSupervisorMetricsByTeam(orgId, teams, type, queryFilters, isOrgAdmin, filterOptions)
                    .then(result => {
                        req.postProcessData = result;
                        next();
                    })
                break;
            case "jobfunction":
                resolvedUsers.forEach(user => {
                    if (user.jobFunctionId) {
                        promiseArray.push(gloveMetricCollection.getSupervisorMetricsByUser(orgId, user, queryFilters.startDate, queryFilters.endDate, type))
                    }
                });
                break;
            case "employee":
                resolvedUsers.forEach(user => {
                    promiseArray.push(gloveMetricCollection.getSupervisorMetricsByUser(orgId, user, queryFilters.startDate, queryFilters.endDate, type))
                });
                break;
            case "subtotal":
                /**tbd */
                return gloveMetricLogics.getTeamMetricSubTotal(orgId, uid, queryFilters, type)
                    .then(result => {
                        req.postProcessData = result;
                        console.log('final result', result);
                        next();
                    })
                break;
            default:
                /** */
                return gloveMetricLogics.getTeamMetricByTime(orgId, uid, type, queryFilters)
                    .then(result => {
                        req.postProcessData = result;
                        next();
                    })
                break;
        }


    }

    /*
        * get users based on the given metrics
    */
    function getUsers(userId, teams, type, queryFilters, filterOptions) {
        metricUserLogics.getResolvedUsersByJob(userId, teams, type, queryFilters, filterOptions).then(users => {
            return users;
        }).catch(() => {
            var err = new Error('E005');
            err.code = 'E005';
            throw err;
        })
    }


}