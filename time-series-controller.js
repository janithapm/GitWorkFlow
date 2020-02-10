/**
 * This module handles functioanlity related to user based metric basic queries. 
 *
 * @module LocationController
 * @version 1.3
 */
module.exports = function ({ express, moment, gloveMetricLogics }) {
    this.expressRouter = new express.Router({ mergeParams: true });
    this.expressRouter.post('', teamMetrics);
    return this.expressRouter;

    function teamMetrics(req, res, next) {

        const { params: { orgId }, query: { startDate, endDate }, body: { filters } } = req;
        let { query: { type } } = req;
        const teams = req.resolvedPermissions.resolved.teams;
        const uid = req.resolvedPermissions.individual[0];
        const filterOptions = req.body.filters;

        type = type.toLowerCase();

        if (!orgId || !startDate || !endDate || !type || !uid) {
            var err = new Error('E005');
            err.code = 'E004';
            next(err);
        }

        const queryFilters = {
            startDate,
            endDate,
            filters,
            type
        };

        return gloveMetricLogics.getMetricsOnType(uid, teams, type, queryFilters, filterOptions)
            .then(result => {
                req.preProcessData = result;
                next();
            }).catch(err => {

            })

    }

}