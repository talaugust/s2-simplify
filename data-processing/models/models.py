import configparser

from peewee import (
    CharField,
    CompositeKey,
    DateTimeField,
    FloatField,
    ForeignKeyField,
    IntegerField,
    Model,
    PostgresqlDatabase,
    TextField,
)

DATABASE_CONFIG = "config.ini"


config = configparser.ConfigParser()
config.read(DATABASE_CONFIG)


def init_database(
    conf: configparser.ConfigParser, config_section: str
) -> PostgresqlDatabase:
    db_name = conf[config_section]["db_name"]
    user = conf[config_section]["user"]
    password = conf[config_section]["password"]
    host = conf[config_section]["host"]
    port = conf[config_section]["port"]
    return PostgresqlDatabase(
        db_name, user=user, password=password, host=host, port=port
    )


input_database = init_database(config, "input-db")
output_database = init_database(config, "output-db")


class InputModel(Model):  # type: ignore
    """
    Input models are read but never written. These specifications of input models in this file
    only need to define the fields we want to read, and they may not be a complete specification
    of the table (i.e. they might leave out indexes or columns).
    """

    class Meta:
        database = input_database


class Metadata(InputModel):
    metadata_id = TextField()
    created_ts = DateTimeField()


class OutputModel(Model):  # type: ignore
    class Meta:
        database = output_database


class Paper(OutputModel):
    s2_id = CharField(primary_key=True)
    arxiv_id = CharField(index=True, null=True)


class Summary(OutputModel):
    paper = ForeignKeyField(Paper, on_delete="CASCADE")
    title = TextField()
    authors = TextField()
    doi = TextField(null=True)
    venue = TextField(index=True, null=True)
    year = IntegerField(index=True, null=True)
    """
    Abstract will probably be backfilled.
    """
    abstract = TextField(null=True)


class Citation(OutputModel):
    paper = ForeignKeyField(Paper, on_delete="CASCADE")


class CitationPaper(OutputModel):
    citation = ForeignKeyField(Citation, on_delete="CASCADE")
    paper = ForeignKeyField(Paper, on_delete="CASCADE")

    class Meta:
        primary_key = CompositeKey("citation", "paper")


class MathMl(OutputModel):
    mathml = TextField(unique=True, index=True)


class MathMlMatch(OutputModel):
    """
    A search result for a MathML equation for a paper.
    """

    paper = ForeignKeyField(Paper, on_delete="CASCADE")
    mathml = ForeignKeyField(MathMl, on_delete="CASCADE")
    match = ForeignKeyField(MathMl, on_delete="CASCADE")
    rank = IntegerField(index=True)


class Symbol(OutputModel):
    paper = ForeignKeyField(Paper, on_delete="CASCADE")
    mathml = ForeignKeyField(MathMl, on_delete="CASCADE")


class SymbolChild(OutputModel):
    """
    Some symbols are parents of other symbols. This has implications for interaction (i.e.
    a user may want to double click a child symbol to select the parent.) Any symbol will have
    a maximum of one parent.
    """

    parent = ForeignKeyField(Symbol, on_delete="CASCADE")
    child = ForeignKeyField(Symbol, on_delete="CASCADE")

    class Meta:
        primary_key = CompositeKey("parent", "child")


class Entity(OutputModel):
    type = TextField(choices=(("citation", None), ("symbol", None)))
    entity_id = IntegerField(index=True)


class BoundingBox(OutputModel):
    """
    Expressed in PDF coordinates.
    """

    page = IntegerField()
    left = FloatField()
    top = FloatField()
    width = FloatField()
    height = FloatField()


class EntityBoundingBox(OutputModel):
    entity = ForeignKeyField(Entity, on_delete="CASCADE")
    bounding_box = ForeignKeyField(BoundingBox, on_delete="CASCADE")

    class Meta:
        primary_key = CompositeKey("entity", "bounding_box")


class Annotation(BoundingBox):
    """
    Human annotation of an entity on a paper. Creating instances of this model with the automated
    data processing pipeline would be unexpected.
    """

    paper = ForeignKeyField(Paper, on_delete="CASCADE")
    type = TextField(choices=(("citation", None), ("symbol", None)), index=True)


def create_tables() -> None:
    """
    Initialize any tables that haven't yet been created.
    """
    output_database.create_tables(
        [
            Paper,
            Summary,
            MathMl,
            MathMlMatch,
            Symbol,
            SymbolChild,
            Citation,
            CitationPaper,
            Entity,
            BoundingBox,
            EntityBoundingBox,
            Annotation,
        ],
        safe=True,
    )
