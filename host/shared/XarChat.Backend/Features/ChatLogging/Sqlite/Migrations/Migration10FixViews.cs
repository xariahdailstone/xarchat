using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration10FixViews : MigrationBase
    {
        protected override int Version => 10;

        public override bool VacuumAfterMigration => false;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync("DROP VIEW viewchannelmessage",
                cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("DROP VIEW viewpmconvomessage",
                cnn, xa, cancellationToken);

            // Recreate existing views
            await ExecuteNonQueryAsync(
                @"CREATE VIEW viewchannelmessage as
                    select m.id, c.name as channelname, c.title as channeltitle, sc.name as speaker, m.messagetype, ts.value as messagetext, m.timestamp
                    from channelmessage m
                    inner join channel c on c.id = m.channelid
                    inner join character sc on sc.id = m.speakingcharacterid
                    inner join strings ts on ts.id = m.textstringid
                    where c.channeltype = 'C'",
                cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync(
                @"CREATE VIEW viewpmconvomessage as
	                select m.id, mc.name as mycharacter, ic.name as interlocutor, sc.name as speaker, m.messagetype, ts.value as messagetext, m.timestamp
	                from channelmessage m
	                inner join channel c on c.id = m.channelid
	                inner join character mc on mc.id = c.mycharacterid
	                inner join character ic on ic.id = c.interlocutorcharacterid
	                inner join character sc on sc.id = m.speakingcharacterid
	                inner join strings ts on ts.id = m.textstringid
	                where c.channeltype = 'P'",
                cnn, xa, cancellationToken);

            // Create version 10 forward compat views
            await ExecuteNonQueryAsync(
                @"CREATE VIEW viewchannelmessage_v10 AS
                    select m.id as channelmessageid, 
                        c.id as channelid,
                        c.name as channelname,
	                    c.title as channeltitle, 
	                    sc.id as speakercharacterid,
	                    sc.name as speakername,
                        m.messagetype as messagetypeid,
	                    case
		                    when m.messagetype = 0 then 'CHAT'
		                    when m.messagetype = 1 then 'AD'
		                    when m.messagetype = 2 then 'ROLL'
		                    when m.messagetype = 3 then 'SPIN'
		                    else 'UNKNOWN'
	                    end as messagetype, 
	                    ts.id as messagetextid,
	                    ts.value as messagetext, 
	                    m.timestamp,
	                    m.genderid as speakergenderid,
	                    case
		                    when m.genderid = 0 then 'none'
		                    when m.genderid = 1 then 'male'
		                    when m.genderid = 2 then 'male-herm'
		                    when m.genderid = 3 then 'female'
		                    when m.genderid = 4 then 'herm'
		                    when m.genderid = 5 then 'cunt-boy'
		                    when m.genderid = 6 then 'transgender'
		                    when m.genderid = 7 then 'shemale'
		                    when m.genderid = 8 then 'male-trans'
		                    when m.genderid = 9 then 'female-trans'
		                    when m.genderid = 10 then 'intersex'
		                    when m.genderid = 11 then 'nonbinary'
		                    else 'unknown'
	                    end as speakergender,
	                    m.onlinestatusid as speakeronlinestatusid,
	                    case
		                    when m.onlinestatusid = 0 then 'offline'
		                    when m.onlinestatusid = 1 then 'online'
		                    when m.onlinestatusid = 2 then 'away'
		                    when m.onlinestatusid = 3 then 'idle'
		                    when m.onlinestatusid = 4 then 'dnd'
		                    when m.onlinestatusid = 5 then 'busy'
		                    when m.onlinestatusid = 6 then 'looking'
		                    when m.onlinestatusid = 7 then 'crown'
		                    else 'unknown'
	                    end as speakeronlinestatus
                    from channelmessage m
                    inner join channel c on c.id = m.channelid
                    inner join character sc on sc.id = m.speakingcharacterid
                    inner join strings ts on ts.id = m.textstringid
                    where c.channeltype = 'C'",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(
                @"CREATE VIEW viewpmconvomessage_v10 AS
					select m.id as channelmessageid, 
						mc.id as mycharacterid,
						mc.name as mycharactername,
						ic.id as interlocutorcharacterid,
						ic.name as interlocutorname, 
						sc.id as speakercharacterid,
						sc.name as speakername,
						m.messagetype as messagetypeid,
						case
							when m.messagetype = 0 then 'CHAT'
							when m.messagetype = 1 then 'AD'
							when m.messagetype = 2 then 'ROLL'
							when m.messagetype = 3 then 'SPIN'
							else 'UNKNOWN'
						end as messagetype, 
						ts.id as messagetextid,
						ts.value as messagetext,
						m.timestamp,
						m.genderid as speakergenderid,
						case
							when m.genderid = 0 then 'none'
							when m.genderid = 1 then 'male'
							when m.genderid = 2 then 'male-herm'
							when m.genderid = 3 then 'female'
							when m.genderid = 4 then 'herm'
							when m.genderid = 5 then 'cunt-boy'
							when m.genderid = 6 then 'transgender'
							when m.genderid = 7 then 'shemale'
							when m.genderid = 8 then 'male-trans'
							when m.genderid = 9 then 'female-trans'
							when m.genderid = 10 then 'intersex'
							when m.genderid = 11 then 'nonbinary'
							else 'unknown'
						end as speakergender,
						m.onlinestatusid as speakeronlinestatusid,
						case
							when m.onlinestatusid = 0 then 'offline'
							when m.onlinestatusid = 1 then 'online'
							when m.onlinestatusid = 2 then 'away'
							when m.onlinestatusid = 3 then 'idle'
							when m.onlinestatusid = 4 then 'dnd'
							when m.onlinestatusid = 5 then 'busy'
							when m.onlinestatusid = 6 then 'looking'
							when m.onlinestatusid = 7 then 'crown'
							else 'unknown'
						end as speakeronlinestatus
					from channelmessage m
					inner join channel c on c.id = m.channelid
					inner join character mc on mc.id = c.mycharacterid
					inner join character ic on ic.id = c.interlocutorcharacterid
					inner join character sc on sc.id = m.speakingcharacterid
					inner join strings ts on ts.id = m.textstringid
					where c.channeltype = 'P'",
                cnn, xa, cancellationToken);

			await ExecuteNonQueryAsync(
                @"CREATE VIEW viewchannels_v10 AS
					select
						c.id as channelid,
						c.name as channelname,
						c.title as channeltitle
					from channel c
					where c.channeltype = 'C'",
				cnn, xa, cancellationToken);

			await ExecuteNonQueryAsync(
                @"CREATE VIEW viewpmconvos_v10 AS
					select
						c.id as channelid,
						c.mycharacterid as mycharacterid,
						mch.name as mycharactername,
						c.interlocutorcharacterid as interlocutorcharacterid,
						ich.name as interlocutorcharactername
					from channel c
					inner join character mch on mch.id = c.mycharacterid
					inner join character ich on ich.id = c.interlocutorcharacterid
					where c.channeltype = 'P'",
				cnn, xa, cancellationToken);

			await ExecuteNonQueryAsync(
                @"CREATE VIEW viewcharacters_v10 AS
					select
						c.id as characterid,
						c.name as charactername,
						c.namelower as characternamelower
					from character c",
				cnn, xa, cancellationToken);
        }
    }
}
