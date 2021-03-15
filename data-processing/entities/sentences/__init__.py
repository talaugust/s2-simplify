from common.commands.base import CommandList
from common.commands.detect_entities import make_detect_entities_command
from common.commands.upload_entities import make_upload_entities_command
from entities.sentences.commands.fetch_spp_jsons import FetchSppJsons
from entities.sentences_pdf.commands.locate_sentences import LocateSentencesCommand
from entities.sentences_pdf.upload import upload_sentences
from scripts.pipelines import EntityPipeline, register_entity_pipeline
from .colorize import adjust_color_positions
from .extractor import SentenceExtractor
from .types import Sentence

commands: CommandList = []

# step 1: detect sentences in latex
directories.register(f"detected-sentences")
commands.append(make_detect_entities_command('sentences', SentenceExtractor))

# step 2: download spp from s3
directories.register('fetched-spp-jsons')
commands.append(FetchSppJsons)

# step 3: compute sentence bboxes via fuzzy matching
directories.register(f"sentences-locations")
commands.append(LocateSentencesCommand)

# step 4: upload
upload_command = make_upload_entities_command('sentences', upload_sentences, DetectedEntityType=Sentence)
commands.append(upload_command)

# register
sentences_pipeline = EntityPipeline("sentences", commands)
register_entity_pipeline(sentences_pipeline)
