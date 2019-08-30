import * as moment from 'moment';

export default class CDRProcessor {
    public static processCDR(cdr: any, logger: any) {
        // add missing date fields
        const cdrDate = moment.unix(cdr.timestamp - 62167219200);
        cdr.datetime = cdrDate.format('YYYY-MM-DD HH:mm:ss');
        cdr.unix_timestamp = cdrDate.unix();
        cdr.rfc_1036 = cdrDate.format('ddd, D MMM YYYY HH:mm:ss zz');
        cdr.iso_8601 = cdrDate.format('YYYY-MM-DD');
        cdr.iso_8601_combined = cdrDate.format('YYYY-MM-DDTHH:mm:ss') + 'Z';

        // set dialed_number property
        try {
            cdr.dialed_number = cdr.call_direction === 'inbound' ? cdr.request.split('@')[0] : cdr.to.split('@')[0];
        } catch (err) {
            logger.error('Failed to determine dialed_number');
            logger.error(err);
        }
        
        // set calling_from property
        try {
            cdr.calling_from = cdr.call_direction === 'inbound' ? cdr.caller_id_number : cdr.from_uri.split('@')[0];
        } catch (err) {
            logger.error('Failed to determine calling_from');
            logger.error(err);
        }

        return cdr;
    }
}
