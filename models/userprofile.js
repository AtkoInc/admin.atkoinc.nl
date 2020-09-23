var logger = require('../logger.js')

class UserProfile {
    constructor(profileJson) {
        if(profileJson){
            try {
                this.id = profileJson.id
                this.userName = profileJson.profile.email
                this.firstName = profileJson.profile.firstName
                this.lastName = profileJson.profile.lastName
                this.name = profileJson.profile.firstName + " " + profileJson.profile.lastName
                this.phoneNumber = profileJson.profile.mobilePhone
                this.email = profileJson.profile.email
                this.title = profileJson.profile.title
                this.account_type = profileJson.profile.account_type
                this.organization = profileJson.profile.organization
                this.status = profileJson.status
                this.account_federated = profileJson.profile.account_federated
                if (profileJson.profile.mfa_preferred) {
                    this.mfaPreferred = profileJson.profile.mfa_preferred    
                } else {
                    this.mfaPreferred = 'false'
                }
                this.lastLogin = profileJson.lastLogin
                this.lastUpdate = profileJson.lastUpdated
//                this.mail_service = profileJson.mail_service
//                this.mail_newsletter = profileJson.mail_newsletter
//                this.mail_daydeals = profileJson.mail_daydeals
            }
            catch(error) {
                logger.error(error);
            }
        }
    }

    setAccountCreator(linkedObjectJson) {
        this.account_creator = new UserProfile(linkedObjectJson)
    }

    setAccountOwner(linkedObjectJson){
        this.account_owner = new UserProfile(linkedObjectJson)
    }
}

module.exports = UserProfile